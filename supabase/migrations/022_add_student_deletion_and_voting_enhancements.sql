-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 022: Student Deletion RPCs, Self-Healing submit_votes & Data Consistency
-- ========================================================

SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Self-Healing, High-Concurrency submit_votes RPC
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_votes(
  p_category_id UUID,
  p_votes JSONB,
  p_student_id UUID DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_submission_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_is_voting_open BOOLEAN;
  v_results_finalized BOOLEAN;
  v_scheduled_start TIMESTAMPTZ;
  v_scheduled_end TIMESTAMPTZ;
  v_required_votes INT := 5;
  v_category_exists BOOLEAN;
  v_category_active BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_elem JSONB;
  v_teacher_id UUID;
  v_vote_count INT;
  v_is_revoked BOOLEAN;
  v_existing_submission_id UUID;
  v_device_already_voted BOOLEAN;
  v_teacher_valid BOOLEAN;
  v_mapping_exists BOOLEAN;
BEGIN
  -- 1. Idempotency Check: if this submission_id was already recorded, return success safely
  IF p_submission_id IS NOT NULL THEN
    SELECT id INTO v_existing_submission_id
    FROM public.vote_submissions
    WHERE id = p_submission_id;

    IF v_existing_submission_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PROCESSED',
        'submission_id', p_submission_id,
        'message', 'Your vote has already been recorded.'
      );
    END IF;
  END IF;

  -- 2. Resolve Student ID (with fallback to device profile or auto-created student)
  v_student_id := COALESCE(auth.uid(), p_student_id);

  IF v_student_id IS NULL THEN
    IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
      SELECT id INTO v_student_id
      FROM public.profiles
      WHERE device_id = p_device_id AND role = 'student'
      LIMIT 1;

      IF v_student_id IS NULL THEN
        v_student_id := gen_random_uuid();
        INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
        VALUES (
          v_student_id,
          'device_' || substring(p_device_id from 1 for 12) || '@student.college',
          'Student Voter',
          'student',
          p_device_id,
          NOW()
        )
        ON CONFLICT (id) DO NOTHING;
      END IF;
    ELSE
      v_student_id := gen_random_uuid();
      INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
      VALUES (
        v_student_id,
        'anon_' || substring(v_student_id::text from 1 for 8) || '@student.college',
        'Student Voter',
        'student',
        p_device_id,
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- 3. Check if student or device was revoked by administrator
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE (user_id = v_student_id::TEXT OR (p_device_id IS NOT NULL AND p_device_id <> '' AND device_id = p_device_id))
      AND is_active = false
  ) INTO v_is_revoked;

  IF v_is_revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCOUNT_REVOKED',
      'message', 'Access Denied: Your account access has been restricted by the administrator.'
    );
  END IF;

  -- Ensure student profile exists in profiles table
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id) THEN
    INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
    VALUES (
      v_student_id,
      'student_' || substring(v_student_id::text from 1 for 8) || '@student.college',
      'Student Voter',
      'student',
      p_device_id,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 4. Validate Voting Settings
  SELECT is_voting_open, results_finalized, scheduled_start, scheduled_end, COALESCE(votes_per_category, 5)
  INTO v_is_voting_open, v_results_finalized, v_scheduled_start, v_scheduled_end, v_required_votes
  FROM public.voting_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    v_is_voting_open := true;
    v_results_finalized := false;
    v_required_votes := 5;
  END IF;

  IF v_results_finalized THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'Voting is closed. Results have been finalized.'
    );
  END IF;

  IF NOT v_is_voting_open THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'Voting is currently closed by the administrator.'
    );
  END IF;

  IF v_scheduled_start IS NOT NULL AND NOW() < v_scheduled_start THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'Voting has not started yet.'
    );
  END IF;

  IF v_scheduled_end IS NOT NULL AND NOW() > v_scheduled_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'The voting period has ended.'
    );
  END IF;

  -- 5. Validate Category Exists and is Active
  SELECT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id),
         COALESCE((SELECT is_active FROM public.categories WHERE id = p_category_id), false)
  INTO v_category_exists, v_category_active;

  IF NOT v_category_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CATEGORY_NOT_FOUND',
      'message', 'The specified award category does not exist.'
    );
  END IF;

  IF NOT v_category_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CATEGORY_INACTIVE',
      'message', 'Voting is disabled for this category.'
    );
  END IF;

  -- 6. Self-Healing check: If category_teachers has 0 rows for this category, auto-seed them
  SELECT EXISTS (
    SELECT 1 FROM public.category_teachers WHERE category_id = p_category_id
  ) INTO v_mapping_exists;

  IF NOT v_mapping_exists THEN
    IF p_category_id = '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0'::UUID THEN
      INSERT INTO public.category_teachers (category_id, teacher_id)
      SELECT p_category_id, id FROM public.teachers WHERE department = 'Non-Technical Staff' AND is_active = true
      ON CONFLICT (category_id, teacher_id) DO NOTHING;
    ELSE
      INSERT INTO public.category_teachers (category_id, teacher_id)
      SELECT p_category_id, id FROM public.teachers WHERE department <> 'Non-Technical Staff' AND is_active = true
      ON CONFLICT (category_id, teacher_id) DO NOTHING;
    END IF;
  END IF;

  -- 7. Duplicate Submission Check (Student + Category)
  IF EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE student_id = v_student_id AND category_id = p_category_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'DUPLICATE_SUBMISSION',
      'error_code', 'DUPLICATE_SUBMISSION',
      'message', 'You have already submitted your vote for this category.'
    );
  END IF;

  -- 8. Device Anti-Abuse Check (1 Account per Device per Category)
  IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vote_submissions
      WHERE device_id = p_device_id
        AND category_id = p_category_id
        AND student_id <> v_student_id
    ) INTO v_device_already_voted;

    IF v_device_already_voted THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'DEVICE_ALREADY_VOTED',
        'error_code', 'DEVICE_ALREADY_VOTED',
        'message', 'A vote has already been cast from this device for this category by another student account.'
      );
    END IF;
  END IF;

  -- 9. Validate Votes Array Structure and Sum
  IF p_votes IS NULL OR jsonb_array_length(p_votes) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EMPTY_VOTES',
      'message', 'No vote allocations were provided.'
    );
  END IF;

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count IS NULL OR v_vote_count <= 0 THEN
      CONTINUE;
    END IF;

    v_total_votes := v_total_votes + v_vote_count;

    -- Validate teacher exists, is active, and is assigned to category
    SELECT EXISTS (
      SELECT 1 FROM public.category_teachers ct
      JOIN public.teachers t ON t.id = ct.teacher_id
      WHERE ct.category_id = p_category_id
        AND ct.teacher_id = v_teacher_id
        AND t.is_active = true
    ) INTO v_teacher_valid;

    IF NOT v_teacher_valid THEN
      -- If teacher exists and is active, auto-link to category for self-healing
      IF EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id AND is_active = true) THEN
        INSERT INTO public.category_teachers (category_id, teacher_id)
        VALUES (p_category_id, v_teacher_id)
        ON CONFLICT (category_id, teacher_id) DO NOTHING;
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'TEACHER_NOT_IN_CATEGORY',
          'message', 'Teacher is not an eligible nominee for this category.'
        );
      END IF;
    END IF;
  END LOOP;

  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTE_LIMIT_EXCEEDED',
      'message', format('Please allocate exactly %s votes. (Currently allocated: %s)', v_required_votes, v_total_votes)
    );
  END IF;

  -- --------------------------------------------------------
  -- ATOMIC DATABASE COMMIT
  -- --------------------------------------------------------
  v_submission_id := COALESCE(p_submission_id, gen_random_uuid());

  INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
  VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW())
  ON CONFLICT (student_id, category_id) DO NOTHING;

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count IS NOT NULL AND v_vote_count > 0 THEN
      -- Insert detailed vote item
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_teacher_id, v_vote_count);

      -- Update materialized vote total (Atomic Increment)
      INSERT INTO public.vote_totals (category_id, teacher_id, total_votes, updated_at)
      VALUES (p_category_id, v_teacher_id, v_vote_count, NOW())
      ON CONFLICT (category_id, teacher_id)
      DO UPDATE SET
        total_votes = public.vote_totals.total_votes + EXCLUDED.total_votes,
        updated_at = NOW();
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'message', 'Your vote has been submitted successfully!'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'TRANSACTION_ERROR',
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_votes(UUID, JSONB, UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 2. Atomic Student Account Deletion RPC
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_student_account(
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_item RECORD;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'student_id is required');
  END IF;

  -- 1. Decrement vote_totals for all ballots cast by this student
  FOR v_sub IN SELECT id, category_id FROM public.vote_submissions WHERE student_id = p_student_id
  LOOP
    FOR v_item IN SELECT teacher_id, vote_count FROM public.vote_items WHERE submission_id = v_sub.id
    LOOP
      UPDATE public.vote_totals
      SET total_votes = GREATEST(0, total_votes - v_item.vote_count),
          updated_at = NOW()
      WHERE category_id = v_sub.category_id AND teacher_id = v_item.teacher_id;
    END LOOP;
  END LOOP;

  -- 2. Delete vote items, submissions, appreciation notes
  DELETE FROM public.vote_items
  WHERE submission_id IN (SELECT id FROM public.vote_submissions WHERE student_id = p_student_id);

  DELETE FROM public.vote_submissions
  WHERE student_id = p_student_id;

  DELETE FROM public.appreciation_messages
  WHERE student_id = p_student_id;

  -- 3. Delete user sessions and profile
  DELETE FROM public.user_sessions
  WHERE user_id = p_student_id::TEXT;

  DELETE FROM public.profiles
  WHERE id = p_student_id AND role = 'student';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student account and ballot data deleted successfully.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_student_account(UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 3. Atomic Delete All Students RPC
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_all_students_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all detailed vote items
  DELETE FROM public.vote_items;

  -- Delete all student vote submissions
  DELETE FROM public.vote_submissions;

  -- Delete all aggregate vote totals
  DELETE FROM public.vote_totals;

  -- Delete all student appreciation messages
  DELETE FROM public.appreciation_messages;

  -- Delete student sessions
  DELETE FROM public.user_sessions
  WHERE role = 'student';

  -- Delete all student user profiles (preserves admin accounts)
  DELETE FROM public.profiles
  WHERE role = 'student';

  -- Clear device_id from remaining profiles
  UPDATE public.profiles
  SET device_id = NULL;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'All student accounts and voting records have been cleared.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_all_students_rpc() TO authenticated, anon, service_role;
