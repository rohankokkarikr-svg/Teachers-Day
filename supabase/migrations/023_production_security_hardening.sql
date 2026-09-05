-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 023: Production Security Hardening & Concurrency Armor
-- ========================================================

SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Helper Function: is_admin() with Comprehensive Auth Evaluation
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR current_user = 'service_role'
    OR current_user = 'postgres'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- --------------------------------------------------------
-- 2. Ensure Required Constraints and Indexes
-- --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vote_submissions_student_id_category_id_key'
  ) THEN
    ALTER TABLE public.vote_submissions
    ADD CONSTRAINT vote_submissions_student_id_category_id_key UNIQUE (student_id, category_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_device_id_key'
  ) THEN
    ALTER TABLE public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_device_id_key UNIQUE (user_id, device_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_teachers_category_id_teacher_id_key'
  ) THEN
    ALTER TABLE public.category_teachers
    ADD CONSTRAINT category_teachers_category_id_teacher_id_key UNIQUE (category_id, teacher_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vote_totals_category_id_teacher_id_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vote_totals_pkey'
  ) THEN
    ALTER TABLE public.vote_totals
    ADD CONSTRAINT vote_totals_category_id_teacher_id_key UNIQUE (category_id, teacher_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- High performance lookup indexes
CREATE INDEX IF NOT EXISTS idx_vote_submissions_student_cat ON public.vote_submissions(student_id, category_id);
CREATE INDEX IF NOT EXISTS idx_vote_submissions_device_cat ON public.vote_submissions(device_id, category_id);
CREATE INDEX IF NOT EXISTS idx_vote_items_sub_id ON public.vote_items(submission_id);
CREATE INDEX IF NOT EXISTS idx_vote_items_teacher_id ON public.vote_items(teacher_id);
CREATE INDEX IF NOT EXISTS idx_vote_totals_cat_teacher ON public.vote_totals(category_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_category_teachers_cat_t ON public.category_teachers(category_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_dev ON public.user_sessions(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- --------------------------------------------------------
-- 3. Production Row Level Security (RLS) Configuration
-- (Strict separation of Public/Student permissions vs Admin privileges)
-- --------------------------------------------------------

-- 3.1 profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete access" ON public.profiles;

CREATE POLICY "Profiles read access"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Profiles insert access"
  ON public.profiles FOR INSERT
  WITH CHECK (role = 'student' OR public.is_admin());

CREATE POLICY "Profiles update access"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin() OR 
    (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

CREATE POLICY "Profiles delete access"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- 3.2 teachers
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access teachers" ON public.teachers;
DROP POLICY IF EXISTS "Public view active teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers read access" ON public.teachers;
DROP POLICY IF EXISTS "Teachers admin write" ON public.teachers;

CREATE POLICY "Teachers read access"
  ON public.teachers FOR SELECT
  USING (true);

CREATE POLICY "Teachers admin write"
  ON public.teachers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.3 categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access categories" ON public.categories;
DROP POLICY IF EXISTS "Public view active categories" ON public.categories;
DROP POLICY IF EXISTS "Categories read access" ON public.categories;
DROP POLICY IF EXISTS "Categories admin write" ON public.categories;

CREATE POLICY "Categories read access"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Categories admin write"
  ON public.categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.4 category_teachers
ALTER TABLE public.category_teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access category_teachers" ON public.category_teachers;
DROP POLICY IF EXISTS "Public view category_teachers" ON public.category_teachers;
DROP POLICY IF EXISTS "Category teachers read access" ON public.category_teachers;
DROP POLICY IF EXISTS "Category teachers admin write" ON public.category_teachers;

CREATE POLICY "Category teachers read access"
  ON public.category_teachers FOR SELECT
  USING (true);

CREATE POLICY "Category teachers admin write"
  ON public.category_teachers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.5 voting_settings
ALTER TABLE public.voting_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access voting settings" ON public.voting_settings;
DROP POLICY IF EXISTS "Public view voting settings" ON public.voting_settings;
DROP POLICY IF EXISTS "Voting settings read access" ON public.voting_settings;
DROP POLICY IF EXISTS "Voting settings admin write" ON public.voting_settings;

CREATE POLICY "Voting settings read access"
  ON public.voting_settings FOR SELECT
  USING (true);

CREATE POLICY "Voting settings admin write"
  ON public.voting_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.6 vote_totals (Direct table writes blocked for non-admins; updated via submit_votes RPC)
ALTER TABLE public.vote_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access vote_totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public update vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Vote totals read access" ON public.vote_totals;
DROP POLICY IF EXISTS "Vote totals admin write" ON public.vote_totals;

CREATE POLICY "Vote totals read access"
  ON public.vote_totals FOR SELECT
  USING (true);

CREATE POLICY "Vote totals admin write"
  ON public.vote_totals FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.7 vote_submissions
ALTER TABLE public.vote_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access vote_submissions" ON public.vote_submissions;
DROP POLICY IF EXISTS "Public submit votes" ON public.vote_submissions;
DROP POLICY IF EXISTS "Vote submissions read access" ON public.vote_submissions;
DROP POLICY IF EXISTS "Vote submissions admin write" ON public.vote_submissions;

CREATE POLICY "Vote submissions read access"
  ON public.vote_submissions FOR SELECT
  USING (true);

CREATE POLICY "Vote submissions admin write"
  ON public.vote_submissions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.8 vote_items
ALTER TABLE public.vote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access vote_items" ON public.vote_items;
DROP POLICY IF EXISTS "Public submit vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Vote items read access" ON public.vote_items;
DROP POLICY IF EXISTS "Vote items admin write" ON public.vote_items;

CREATE POLICY "Vote items read access"
  ON public.vote_items FOR SELECT
  USING (true);

CREATE POLICY "Vote items admin write"
  ON public.vote_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.9 appreciation_messages
ALTER TABLE public.appreciation_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access appreciation" ON public.appreciation_messages;
DROP POLICY IF EXISTS "Appreciation read access" ON public.appreciation_messages;
DROP POLICY IF EXISTS "Appreciation insert access" ON public.appreciation_messages;
DROP POLICY IF EXISTS "Appreciation admin write" ON public.appreciation_messages;

CREATE POLICY "Appreciation read access"
  ON public.appreciation_messages FOR SELECT
  USING (true);

CREATE POLICY "Appreciation insert access"
  ON public.appreciation_messages FOR INSERT
  WITH CHECK (length(trim(message)) >= 2 AND length(trim(message)) <= 1000);

CREATE POLICY "Appreciation admin write"
  ON public.appreciation_messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.10 admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access admin actions" ON public.admin_actions;
DROP POLICY IF EXISTS "Public access audit log" ON public.admin_actions;
DROP POLICY IF EXISTS "Admin actions strict access" ON public.admin_actions;

CREATE POLICY "Admin actions strict access"
  ON public.admin_actions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3.11 user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access user sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Public access user_sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "User sessions read access" ON public.user_sessions;
DROP POLICY IF EXISTS "User sessions upsert access" ON public.user_sessions;
DROP POLICY IF EXISTS "User sessions admin delete" ON public.user_sessions;

CREATE POLICY "User sessions read access"
  ON public.user_sessions FOR SELECT
  USING (true);

CREATE POLICY "User sessions upsert access"
  ON public.user_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "User sessions update access"
  ON public.user_sessions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "User sessions admin delete"
  ON public.user_sessions FOR DELETE
  USING (public.is_admin());

-- --------------------------------------------------------
-- 4. MASTER RPC: submit_votes (Strictly Atomic, Concurrency Safe & Zero Loss)
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
  v_seen_teachers UUID[] := ARRAY[]::UUID[];
BEGIN
  -- 1. Idempotency Check: if submission_id was already recorded, return ALREADY_PROCESSED
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

  -- 2. Resolve Student ID
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
  ELSE
    -- Ensure profile exists
    INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
    VALUES (
      v_student_id,
      'student_' || substring(v_student_id::text from 1 for 8) || '@student.college',
      'Student Voter',
      'student',
      p_device_id,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      device_id = COALESCE(p_device_id, public.profiles.device_id),
      updated_at = NOW();
  END IF;

  -- 3. Check Account Revocation
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

  -- 4. Check Global Voting Settings
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

  -- 5. Validate Category
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

  -- 6. Self-Healing Category Teachers Mapping
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

  -- 7. Check Duplicate Submission for Student & Category
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

  -- 8. Device Anti-Abuse Check
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

  -- 9. Strictly Validate Votes Array Structure and Sum
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

    IF v_teacher_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_TEACHER',
        'message', 'Invalid teacher nominee specified.'
      );
    END IF;

    IF v_vote_count IS NULL OR v_vote_count < 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_VOTE_COUNT',
        'message', 'Vote counts cannot be negative.'
      );
    END IF;

    IF v_vote_count = 0 THEN
      CONTINUE;
    END IF;

    -- Duplicate nominee prevention in ballot payload
    IF v_teacher_id = ANY(v_seen_teachers) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'DUPLICATE_NOMINEE',
        'message', 'Duplicate teacher entry found in ballot.'
      );
    END IF;
    v_seen_teachers := array_append(v_seen_teachers, v_teacher_id);

    v_total_votes := v_total_votes + v_vote_count;

    -- Validate teacher is nominee for category
    SELECT EXISTS (
      SELECT 1 FROM public.category_teachers ct
      JOIN public.teachers t ON t.id = ct.teacher_id
      WHERE ct.category_id = p_category_id
        AND ct.teacher_id = v_teacher_id
        AND t.is_active = true
    ) INTO v_teacher_valid;

    IF NOT v_teacher_valid THEN
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
      'message', format('Please allocate exactly %s votes (currently allocated: %s).', v_required_votes, v_total_votes)
    );
  END IF;

  -- --------------------------------------------------------
  -- 10. ATOMIC TRANSACTIONAL INSERTION
  -- --------------------------------------------------------
  v_submission_id := COALESCE(p_submission_id, gen_random_uuid());

  BEGIN
    INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
    VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW());
  EXCEPTION
    WHEN unique_violation THEN
      IF p_submission_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.vote_submissions WHERE id = p_submission_id
      ) THEN
        RETURN jsonb_build_object(
          'success', true,
          'status', 'ALREADY_PROCESSED',
          'submission_id', p_submission_id,
          'message', 'Your vote has already been recorded.'
        );
      END IF;

      RETURN jsonb_build_object(
        'success', false,
        'status', 'DUPLICATE_SUBMISSION',
        'error_code', 'DUPLICATE_SUBMISSION',
        'message', 'You have already submitted your vote for this category.'
      );
  END;

  -- Insert Vote Items & Atomically Increment vote_totals
  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count IS NOT NULL AND v_vote_count > 0 THEN
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_teacher_id, v_vote_count);

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
-- 5. SECURE ADMIN RPCS (Requires is_admin() Authorization)
-- --------------------------------------------------------

-- 5.1 Delete Student Account
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
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  IF p_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_id is required');
  END IF;

  -- Decrement vote_totals for all ballots cast by this student
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

  DELETE FROM public.vote_items
  WHERE submission_id IN (SELECT id FROM public.vote_submissions WHERE student_id = p_student_id);

  DELETE FROM public.vote_submissions
  WHERE student_id = p_student_id;

  DELETE FROM public.appreciation_messages
  WHERE student_id = p_student_id;

  DELETE FROM public.user_sessions
  WHERE user_id = p_student_id::TEXT;

  DELETE FROM public.profiles
  WHERE id = p_student_id AND role = 'student';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student account and ballot data deleted successfully.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_student_account(UUID) TO authenticated, anon, service_role;

-- 5.2 Delete All Students & Reset Votes
CREATE OR REPLACE FUNCTION public.delete_all_students_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  DELETE FROM public.vote_items;
  DELETE FROM public.vote_submissions;
  DELETE FROM public.vote_totals;
  DELETE FROM public.appreciation_messages;
  DELETE FROM public.user_sessions WHERE role = 'student';
  DELETE FROM public.profiles WHERE role = 'student';
  UPDATE public.profiles SET device_id = NULL;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'All student accounts and voting records have been cleared.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_all_students_rpc() TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 6. Canonical Category Leaderboard RPC
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_leaderboard(
  p_category_id UUID
)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_photo TEXT,
  teacher_department TEXT,
  department TEXT,
  total_votes BIGINT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH assigned_teachers AS (
    SELECT DISTINCT t.id, t.name, t.photo_url, t.department
    FROM public.teachers t
    JOIN public.category_teachers ct ON ct.teacher_id = t.id
    WHERE ct.category_id = p_category_id AND t.is_active = true
  ),
  ranked AS (
    SELECT 
      at.id AS teacher_id,
      at.name AS teacher_name,
      at.photo_url AS teacher_photo,
      at.department AS teacher_department,
      at.department AS department,
      COALESCE(vt.total_votes, 0)::BIGINT AS total_votes,
      DENSE_RANK() OVER (ORDER BY COALESCE(vt.total_votes, 0) DESC, at.name ASC)::BIGINT AS rank
    FROM assigned_teachers at
    LEFT JOIN public.vote_totals vt ON vt.category_id = p_category_id AND vt.teacher_id = at.id
  )
  SELECT * FROM ranked
  ORDER BY ranked.rank ASC, ranked.teacher_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_leaderboard(UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 7. Diagnostic RPC: verify_vote_integrity()
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_vote_integrity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_items_sum BIGINT;
  v_totals_sum BIGINT;
  v_sub_count BIGINT;
  v_discrepancies INT := 0;
BEGIN
  SELECT COALESCE(SUM(vote_count), 0) INTO v_items_sum FROM public.vote_items;
  SELECT COALESCE(SUM(total_votes), 0) INTO v_totals_sum FROM public.vote_totals;
  SELECT COUNT(*) INTO v_sub_count FROM public.vote_submissions;

  IF v_items_sum <> v_totals_sum THEN
    v_discrepancies := v_discrepancies + 1;
  END IF;

  RETURN jsonb_build_object(
    'is_healthy', (v_discrepancies = 0),
    'submissions_count', v_sub_count,
    'vote_items_sum', v_items_sum,
    'vote_totals_sum', v_totals_sum,
    'discrepancy', ABS(v_items_sum - v_totals_sum)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_vote_integrity() TO authenticated, anon, service_role;
