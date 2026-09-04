-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 019: Production Voting Hardening, Server-Side Validation, Atomic Idempotency, RLS Protection & Integrity Verification
-- ========================================================

SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Ensure Table Structure & Strict Unique Constraints
-- --------------------------------------------------------

-- Unique constraint on vote_submissions(student_id, category_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vote_submissions_student_id_category_id_key'
  ) THEN
    ALTER TABLE public.vote_submissions
    ADD CONSTRAINT vote_submissions_student_id_category_id_key UNIQUE (student_id, category_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Unique constraint on user_sessions(user_id, device_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_device_id_key'
  ) THEN
    ALTER TABLE public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_device_id_key UNIQUE (user_id, device_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Unique constraint on category_teachers(category_id, teacher_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_teachers_category_id_teacher_id_key'
  ) THEN
    ALTER TABLE public.category_teachers
    ADD CONSTRAINT category_teachers_category_id_teacher_id_key UNIQUE (category_id, teacher_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Unique constraint on vote_totals(category_id, teacher_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vote_totals_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vote_totals_category_id_teacher_id_key'
  ) THEN
    ALTER TABLE public.vote_totals
    ADD CONSTRAINT vote_totals_category_id_teacher_id_key UNIQUE (category_id, teacher_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- --------------------------------------------------------
-- 2. Indexes for High-Speed Concurrent Transactions
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vote_submissions_student_category 
  ON public.vote_submissions(student_id, category_id);

CREATE INDEX IF NOT EXISTS idx_vote_submissions_device_category 
  ON public.vote_submissions(device_id, category_id);

CREATE INDEX IF NOT EXISTS idx_vote_submissions_submitted_at 
  ON public.vote_submissions(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_vote_items_submission_id 
  ON public.vote_items(submission_id);

CREATE INDEX IF NOT EXISTS idx_vote_items_teacher_id 
  ON public.vote_items(teacher_id);

CREATE INDEX IF NOT EXISTS idx_vote_totals_category_teacher 
  ON public.vote_totals(category_id, teacher_id);

CREATE INDEX IF NOT EXISTS idx_category_teachers_cat_teacher 
  ON public.category_teachers(category_id, teacher_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device 
  ON public.user_sessions(user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_heartbeat 
  ON public.user_sessions(is_active, last_active_at DESC);

-- --------------------------------------------------------
-- 3. Production Hardened submit_votes RPC
-- (Server-Side Validation, No Auto-Creation of Nominees/Categories, Atomic Idempotency & Concurrency Safety)
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
  v_seen_teachers UUID[] := ARRAY[]::UUID[];
BEGIN
  -- ------------------------------------------------------
  -- 1. Idempotency Check
  -- If submission_id was already recorded, return ALREADY_PROCESSED safely
  -- ------------------------------------------------------
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

  -- ------------------------------------------------------
  -- 2. Resolve & Validate Student Identity
  -- ------------------------------------------------------
  v_student_id := COALESCE(auth.uid(), p_student_id);

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_STUDENT',
      'message', 'Student identification is required to submit votes.'
    );
  END IF;

  -- Check if student or session was revoked by administrator
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE (user_id = v_student_id OR (p_device_id IS NOT NULL AND p_device_id <> '' AND device_id = p_device_id))
      AND is_active = false
  ) INTO v_is_revoked;

  IF v_is_revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCOUNT_REVOKED',
      'message', 'Access Denied: Your account access has been restricted by the administrator.'
    );
  END IF;

  -- Ensure student profile exists
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

  -- ------------------------------------------------------
  -- 3. Validate System Voting Settings
  -- ------------------------------------------------------
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

  -- ------------------------------------------------------
  -- 4. Strictly Validate Category (DO NOT AUTO-INSERT)
  -- ------------------------------------------------------
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

  -- ------------------------------------------------------
  -- 5. Duplicate Submission Check (Student + Category)
  -- ------------------------------------------------------
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

  -- ------------------------------------------------------
  -- 6. Device Anti-Abuse Check (1 Account per Device per Category)
  -- ------------------------------------------------------
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
        'status', 'DUPLICATE_SUBMISSION',
        'error_code', 'DUPLICATE_SUBMISSION',
        'message', 'A vote has already been submitted for this category from this device.'
      );
    END IF;
  END IF;

  -- ------------------------------------------------------
  -- 7. Strictly Validate Votes Payload & Teacher Relationships (DO NOT AUTO-INSERT)
  -- ------------------------------------------------------
  IF p_votes IS NULL OR jsonb_array_length(p_votes) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_VOTE',
      'message', 'No vote allocations provided.'
    );
  END IF;

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_teacher_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TEACHER_NOT_FOUND',
        'message', 'Invalid teacher ID specified.'
      );
    END IF;

    IF v_vote_count IS NULL OR v_vote_count < 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_VOTE',
        'message', 'Vote counts must be non-negative integers.'
      );
    END IF;

    -- Check for duplicate teacher entries in same ballot payload
    IF v_teacher_id = ANY(v_seen_teachers) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_VOTE',
        'message', 'Duplicate teacher entries in ballot payload.'
      );
    END IF;
    v_seen_teachers := array_append(v_seen_teachers, v_teacher_id);

    v_total_votes := v_total_votes + v_vote_count;

    IF v_vote_count > 0 THEN
      -- Validate teacher exists in public.teachers
      IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'TEACHER_NOT_FOUND',
          'message', 'Candidate teacher does not exist.'
        );
      END IF;

      -- Validate teacher is active
      IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id AND is_active = true) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'TEACHER_NOT_FOUND',
          'message', 'Candidate teacher is not currently active.'
        );
      END IF;

      -- Validate teacher belongs to category in public.category_teachers
      IF NOT EXISTS (
        SELECT 1 FROM public.category_teachers 
        WHERE category_id = p_category_id AND teacher_id = v_teacher_id
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'TEACHER_NOT_IN_CATEGORY',
          'message', 'Teacher is not an eligible nominee for this category.'
        );
      END IF;
    END IF;
  END LOOP;

  -- ------------------------------------------------------
  -- 8. Validate Exact Server-Side Vote Limit
  -- ------------------------------------------------------
  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTE_LIMIT_EXCEEDED',
      'message', format('Please allocate exactly %s votes. (Currently allocated: %s)', v_required_votes, v_total_votes)
    );
  END IF;

  -- ------------------------------------------------------
  -- 9. ATOMIC DATABASE INSERTION WITH CONCURRENCY RACE PROTECTION
  -- ------------------------------------------------------
  v_submission_id := COALESCE(p_submission_id, gen_random_uuid());

  BEGIN
    INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
    VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW());
  EXCEPTION
    WHEN unique_violation THEN
      -- Check if idempotency key matched
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
      
      -- Student already submitted in concurrent race
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

    IF v_vote_count > 0 THEN
      -- Insert ballot detail row
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_teacher_id, v_vote_count);

      -- Atomic aggregate update on vote_totals
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
    'status', 'SUCCESS',
    'submission_id', v_submission_id,
    'votes_accepted', v_total_votes,
    'message', 'Your vote has been recorded securely!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_votes(UUID, JSONB, UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 4. Single-RPC Student Login & Session Generator (register_or_get_student)
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_or_get_student(
  p_full_name TEXT,
  p_device_id TEXT,
  p_user_agent TEXT DEFAULT 'Web Browser'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_name TEXT;
  v_slug TEXT;
  v_email TEXT;
  v_student_id UUID;
  v_bound_name TEXT;
  v_bound_slug TEXT;
  v_is_revoked BOOLEAN;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_clean_name := trim(p_full_name);
  IF length(v_clean_name) < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_NAME',
      'message', 'Name must be at least 2 characters long.'
    );
  END IF;

  v_slug := regexp_replace(lower(v_clean_name), '[^a-z0-9]+', '.', 'g');
  v_slug := trim(both '.' from v_slug);
  v_email := v_slug || '@student.college';

  -- 1. Check if device is bound to a different student
  IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
    SELECT full_name INTO v_bound_name
    FROM public.profiles
    WHERE device_id = p_device_id AND role = 'student'
    LIMIT 1;

    IF v_bound_name IS NOT NULL THEN
      v_bound_slug := regexp_replace(lower(v_bound_name), '[^a-z0-9]+', '.', 'g');
      v_bound_slug := trim(both '.' from v_bound_slug);
      IF v_bound_slug <> v_slug THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'DEVICE_ALREADY_BOUND',
          'message', format('This device is already registered to "%s". Only 1 student account is permitted per device.', v_bound_name)
        );
      END IF;
    END IF;
  END IF;

  -- 2. Check for existing profile by email
  SELECT id INTO v_student_id
  FROM public.profiles
  WHERE email = v_email
  LIMIT 1;

  IF v_student_id IS NULL THEN
    v_student_id := gen_random_uuid();
    BEGIN
      INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
      VALUES (v_student_id, v_email, v_clean_name, 'student', p_device_id, v_now);
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_student_id FROM public.profiles WHERE email = v_email LIMIT 1;
    END;
  ELSE
    UPDATE public.profiles
    SET full_name = v_clean_name,
        device_id = COALESCE(p_device_id, public.profiles.device_id),
        updated_at = v_now
    WHERE id = v_student_id;
  END IF;

  -- 3. Check Revocation Status in user_sessions
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE (user_id = v_student_id OR email = v_email OR (device_id = p_device_id AND p_device_id <> ''))
      AND is_active = false
  ) INTO v_is_revoked;

  IF v_is_revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCESS_REVOKED',
      'message', 'Access Denied: Your account access has been restricted by the administrator.'
    );
  END IF;

  -- 4. Upsert Active Session Record
  INSERT INTO public.user_sessions (
    id, user_id, full_name, email, role, device_id, user_agent, is_active, login_at, last_active_at
  )
  VALUES (
    'sess_' || v_student_id::text || '_' || right(COALESCE(p_device_id, 'dev'), 6),
    v_student_id,
    v_clean_name,
    v_email,
    'student',
    p_device_id,
    COALESCE(p_user_agent, 'Web Browser'),
    true,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    last_active_at = v_now,
    is_active = true,
    revoked_at = NULL;

  RETURN jsonb_build_object(
    'success', true,
    'student', jsonb_build_object(
      'id', v_student_id,
      'full_name', v_clean_name,
      'email', v_email,
      'role', 'student',
      'device_id', p_device_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_or_get_student(TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 5. Authoritative Leaderboard Function (Reads canonical vote_totals)
-- --------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_category_leaderboard(UUID);

CREATE OR REPLACE FUNCTION public.get_category_leaderboard(
  p_category_id UUID
)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_photo TEXT,
  teacher_department TEXT,
  total_votes BIGINT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH category_assigned_teachers AS (
    SELECT 
      t.id AS t_id,
      t.name AS t_name,
      t.photo_url AS t_photo,
      t.department AS t_dept
    FROM public.teachers t
    INNER JOIN public.category_teachers ct 
      ON ct.teacher_id = t.id 
     AND ct.category_id = p_category_id
    WHERE t.is_active = true
  ),
  canonical_totals AS (
    SELECT 
      vt.teacher_id AS t_id,
      COALESCE(vt.total_votes, 0)::BIGINT AS total_count
    FROM public.vote_totals vt
    WHERE vt.category_id = p_category_id
  )
  SELECT 
    cat.t_id AS teacher_id,
    cat.t_name AS teacher_name,
    cat.t_photo AS teacher_photo,
    cat.t_dept AS teacher_department,
    COALESCE(ct.total_count, 0)::BIGINT AS total_votes,
    DENSE_RANK() OVER (
      ORDER BY 
        COALESCE(ct.total_count, 0) DESC,
        cat.t_name ASC
    )::BIGINT AS rank
  FROM category_assigned_teachers cat
  LEFT JOIN canonical_totals ct ON ct.t_id = cat.t_id
  ORDER BY 
    COALESCE(ct.total_count, 0) DESC,
    cat.t_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_leaderboard(UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 6. Database Voting Integrity Audit Functions
-- Compares SUM(vote_items) with vote_totals for zero-loss audit
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_voting_integrity()
RETURNS TABLE (
  category_id UUID,
  teacher_id UUID,
  items_vote_sum BIGINT,
  stored_total_votes BIGINT,
  discrepancy BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH items_aggregated AS (
    SELECT 
      vs.category_id AS cat_id,
      vi.teacher_id AS t_id,
      SUM(vi.vote_count)::BIGINT AS sum_count
    FROM public.vote_items vi
    INNER JOIN public.vote_submissions vs ON vs.id = vi.submission_id
    GROUP BY vs.category_id, vi.teacher_id
  )
  SELECT 
    COALESCE(ia.cat_id, vt.category_id) AS category_id,
    COALESCE(ia.t_id, vt.teacher_id) AS teacher_id,
    COALESCE(ia.sum_count, 0)::BIGINT AS items_vote_sum,
    COALESCE(vt.total_votes, 0)::BIGINT AS stored_total_votes,
    (COALESCE(vt.total_votes, 0) - COALESCE(ia.sum_count, 0))::BIGINT AS discrepancy
  FROM items_aggregated ia
  FULL OUTER JOIN public.vote_totals vt 
    ON vt.category_id = ia.cat_id 
   AND vt.teacher_id = ia.t_id
  WHERE COALESCE(ia.sum_count, 0) <> COALESCE(vt.total_votes, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_voting_integrity() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_vote_integrity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discrepancies_count INT;
  v_total_submissions INT;
  v_total_votes_recorded INT;
  v_total_votes_items INT;
  v_unique_voters INT;
BEGIN
  SELECT COUNT(*) INTO v_discrepancies_count FROM public.verify_voting_integrity();
  SELECT COUNT(*) INTO v_total_submissions FROM public.vote_submissions;
  SELECT COALESCE(SUM(total_votes), 0) INTO v_total_votes_recorded FROM public.vote_totals;
  SELECT COALESCE(SUM(vote_count), 0) INTO v_total_votes_items FROM public.vote_items;
  SELECT COUNT(DISTINCT student_id) INTO v_unique_voters FROM public.vote_submissions;
  
  RETURN jsonb_build_object(
    'is_healthy', (v_discrepancies_count = 0),
    'discrepancies_count', v_discrepancies_count,
    'total_submissions', v_total_submissions,
    'total_votes_recorded', v_total_votes_recorded,
    'total_votes_items', v_total_votes_items,
    'unique_voters', v_unique_voters
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_vote_integrity() TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 7. Strict Row-Level Security (RLS) Policy Hardening
-- --------------------------------------------------------

-- vote_totals: Restricted from direct public reads; Public reads through get_category_leaderboard() RPC
ALTER TABLE public.vote_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "View vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Admins view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Only admins view vote totals" ON public.vote_totals;

CREATE POLICY "Admins view vote totals"
  ON public.vote_totals FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

-- vote_submissions: Students can only view their own submissions; Admins can view all
ALTER TABLE public.vote_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students view own submissions" ON public.vote_submissions;
DROP POLICY IF EXISTS "Public view vote submissions" ON public.vote_submissions;

CREATE POLICY "Students view own submissions"
  ON public.vote_submissions FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR student_id = auth.uid()
  );

-- vote_items: Students can only view their own ballot items; Admins can view all
ALTER TABLE public.vote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students view own vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Public view vote items" ON public.vote_items;

CREATE POLICY "Students view own vote items"
  ON public.vote_items FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.vote_submissions s
      WHERE s.id = submission_id AND (s.student_id = auth.uid())
    )
  );

-- categories & teachers: Public read-only; Admins full access
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view active categories" ON public.categories;
CREATE POLICY "Public view active categories"
  ON public.categories FOR SELECT
  USING (true);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view active teachers" ON public.teachers;
CREATE POLICY "Public view active teachers"
  ON public.teachers FOR SELECT
  USING (true);

ALTER TABLE public.category_teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view category teachers" ON public.category_teachers;
CREATE POLICY "Public view category teachers"
  ON public.category_teachers FOR SELECT
  USING (true);

-- Ensure Realtime Publications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_totals;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_submissions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END;
$$;
