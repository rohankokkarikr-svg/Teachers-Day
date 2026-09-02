-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 006: Device ID Tracking & Anti-Abuse Enforcement
-- ========================================================

-- 1. Add device_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 2. Add device_id to vote_submissions table
ALTER TABLE public.vote_submissions
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 3. Create index on device_id for rapid anti-abuse lookup
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON public.profiles(device_id);
CREATE INDEX IF NOT EXISTS idx_vote_submissions_device ON public.vote_submissions(device_id, category_id);

-- 4. Update submit_votes RPC to validate and store device_id atomically
CREATE OR REPLACE FUNCTION public.submit_votes(
  p_category_id UUID,
  p_votes JSONB,
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_student_id UUID;
  v_is_voting_open BOOLEAN;
  v_results_finalized BOOLEAN;
  v_category_active BOOLEAN;
  v_already_voted BOOLEAN;
  v_device_already_voted BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_record RECORD;
  v_teacher_valid BOOLEAN;
  v_required_votes INT := 5;
BEGIN
  -- 1. Authenticated User Check
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required. Please sign in.');
  END IF;

  -- 2. Verify Voting Settings Status
  SELECT is_voting_open, results_finalized, votes_per_category
  INTO v_is_voting_open, v_results_finalized, v_required_votes
  FROM public.voting_settings
  WHERE id = 1;

  IF NOT FOUND OR NOT v_is_voting_open THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting is currently closed by the administrator.');
  END IF;

  IF v_results_finalized THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting results have been finalized. No further submissions accepted.');
  END IF;

  -- 3. Verify Category Exists and is Active
  SELECT is_active INTO v_category_active
  FROM public.categories
  WHERE id = p_category_id;

  IF NOT FOUND OR NOT v_category_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or inactive category selected.');
  END IF;

  -- 4. Check for Existing Duplicate Submission (Student ID + Category)
  SELECT EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE student_id = v_student_id AND category_id = p_category_id
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already submitted your vote for this category.');
  END IF;

  -- 5. Anti-Abuse Check: Device ID uniqueness per category
  IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vote_submissions
      WHERE device_id = p_device_id AND category_id = p_category_id
    ) INTO v_device_already_voted;

    IF v_device_already_voted THEN
      RETURN jsonb_build_object('success', false, 'message', 'A vote has already been submitted for this category from this device.');
    END IF;
  END IF;

  -- 6. Calculate Total Allocated Votes and Check Non-negative Values
  FOR v_vote_record IN SELECT * FROM jsonb_to_recordset(p_votes) AS x(teacher_id UUID, vote_count INT)
  LOOP
    IF v_vote_record.vote_count IS NULL OR v_vote_record.vote_count < 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Vote counts must be positive numbers.');
    END IF;

    v_total_votes := v_total_votes + v_vote_record.vote_count;

    -- 7. Verify Teacher belongs to this Category and is Active
    IF v_vote_record.vote_count > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.category_teachers ct
        JOIN public.teachers t ON t.id = ct.teacher_id
        WHERE ct.category_id = p_category_id
          AND ct.teacher_id = v_vote_record.teacher_id
          AND t.is_active = true
      ) INTO v_teacher_valid;

      IF NOT v_teacher_valid THEN
        RETURN jsonb_build_object('success', false, 'message', 'One or more selected teachers are not eligible for this category.');
      END IF;
    END IF;
  END LOOP;

  -- 8. Validate Total Allocated Votes equals exactly required (5)
  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Please allocate exactly %s votes. (Currently allocated: %s)', v_required_votes, v_total_votes)
    );
  END IF;

  -- ------------------------------------------------------
  -- ATOMIC TRANSACTION COMMIT
  -- ------------------------------------------------------
  -- 9. Insert Submission Record (with device_id)
  INSERT INTO public.vote_submissions (student_id, category_id, device_id)
  VALUES (v_student_id, p_category_id, p_device_id)
  RETURNING id INTO v_submission_id;

  -- Update profile device_id if present
  IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
    UPDATE public.profiles
    SET device_id = p_device_id
    WHERE id = v_student_id AND (device_id IS NULL OR device_id = '');
  END IF;

  -- 10. Insert Vote Items and Update Aggregate Vote Totals
  FOR v_vote_record IN SELECT * FROM jsonb_to_recordset(p_votes) AS x(teacher_id UUID, vote_count INT)
  LOOP
    IF v_vote_record.vote_count > 0 THEN
      -- Insert detailed vote item
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_vote_record.teacher_id, v_vote_record.vote_count);

      -- Update materialized vote total (Atomic Increment)
      INSERT INTO public.vote_totals (category_id, teacher_id, total_votes)
      VALUES (p_category_id, v_vote_record.teacher_id, v_vote_record.vote_count)
      ON CONFLICT (category_id, teacher_id)
      DO UPDATE SET
        total_votes = public.vote_totals.total_votes + EXCLUDED.total_votes,
        updated_at = NOW();
    END IF;
  END LOOP;

  -- 11. Return Success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your vote has been submitted successfully!',
    'submission_id', v_submission_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already submitted your vote for this category.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Submission failed due to a database error. Please try again.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
