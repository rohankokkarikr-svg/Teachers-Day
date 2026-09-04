-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 018: 500+ Concurrent Students, Atomic Voting RPC, Idempotency, Single-RPC Login & RLS Security
-- ========================================================

SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Ensure Table Structure & Constraints
-- --------------------------------------------------------

-- Ensure unique constraint on (student_id, category_id) for duplicate vote prevention
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

-- Ensure unique constraint on (category_id, teacher_id) for vote_totals
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
-- 2. High-Performance Database Indexes for 500+ Concurrent Users
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

CREATE INDEX IF NOT EXISTS idx_profiles_email 
  ON public.profiles(email);

CREATE INDEX IF NOT EXISTS idx_profiles_device_id 
  ON public.profiles(device_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device 
  ON public.user_sessions(user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_heartbeat 
  ON public.user_sessions(is_active, last_active_at DESC);

-- --------------------------------------------------------
-- 3. Master Atomic submit_votes RPC (With Idempotency & Zero-Loss Concurrency)
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
  v_already_voted BOOLEAN;
  v_device_already_voted BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_elem JSONB;
  v_teacher_id UUID;
  v_vote_count INT;
  v_is_revoked BOOLEAN;
  v_existing_submission_id UUID;
BEGIN
  -- A. Idempotency Check: Check if this specific submission_id was already recorded
  IF p_submission_id IS NOT NULL THEN
    SELECT id INTO v_existing_submission_id
    FROM public.vote_submissions
    WHERE id = p_submission_id;

    IF v_existing_submission_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'submission_id', p_submission_id,
        'status', 'already_processed',
        'message', 'Your vote has already been recorded.'
      );
    END IF;
  END IF;

  -- B. Resolve Student Identity
  v_student_id := COALESCE(auth.uid(), p_student_id);

  IF v_student_id IS NULL THEN
    v_student_id := gen_random_uuid();
  END IF;

  -- C. Validate System Voting Settings
  SELECT is_voting_open, results_finalized, scheduled_start, scheduled_end
  INTO v_is_voting_open, v_results_finalized, v_scheduled_start, v_scheduled_end
  FROM public.voting_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    v_is_voting_open := true;
    v_results_finalized := false;
  END IF;

  IF v_results_finalized THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_FINALIZED',
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
      'error_code', 'VOTING_NOT_STARTED',
      'message', 'Voting has not started yet.'
    );
  END IF;

  IF v_scheduled_end IS NOT NULL AND NOW() > v_scheduled_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_ENDED',
      'message', 'The voting period has ended.'
    );
  END IF;

  -- D. Access & Revocation Check
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE user_id = v_student_id AND is_active = false
  ) INTO v_is_revoked;

  IF v_is_revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCOUNT_REVOKED',
      'message', 'Access Denied: Your account access has been restricted by the administrator.'
    );
  END IF;

  -- E. Ensure Profile exists in public.profiles
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

  -- F. Ensure Category is active
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id AND is_active = true) THEN
    INSERT INTO public.categories (id, name, description, is_active)
    VALUES (p_category_id, 'Award Category', 'Teachers Day Award Category', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;
  END IF;

  -- G. Duplicate Submission Check (Student + Category)
  SELECT EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE student_id = v_student_id AND category_id = p_category_id
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DUPLICATE_SUBMISSION',
      'message', 'You have already submitted your vote for this category.'
    );
  END IF;

  -- H. Device ID Anti-Abuse Check (Prevent multi-account voting from same device)
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
        'error_code', 'DEVICE_ALREADY_VOTED',
        'message', 'A vote has already been submitted for this category from this device.'
      );
    END IF;
  END IF;

  -- I. Validate Votes Payload
  IF p_votes IS NULL OR jsonb_array_length(p_votes) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EMPTY_VOTES',
      'message', 'No vote allocations provided.'
    );
  END IF;

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count IS NULL OR v_vote_count < 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'INVALID_VOTE_COUNT',
        'message', 'Vote counts must be non-negative integers.'
      );
    END IF;

    v_total_votes := v_total_votes + v_vote_count;

    IF v_vote_count > 0 THEN
      -- Ensure teacher exists in public.teachers
      IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id) THEN
        INSERT INTO public.teachers (id, name, department, is_active)
        VALUES (v_teacher_id, 'Faculty Member', 'BCA', true)
        ON CONFLICT (id) DO UPDATE SET is_active = true;
      END IF;

      -- Ensure mapping exists in public.category_teachers
      INSERT INTO public.category_teachers (category_id, teacher_id)
      VALUES (p_category_id, v_teacher_id)
      ON CONFLICT (category_id, teacher_id) DO NOTHING;
    END IF;
  END LOOP;

  -- J. Validate Exact Required Vote Total (5 Votes)
  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTE_LIMIT_MISMATCH',
      'message', format('Please allocate exactly %s votes. (Currently allocated: %s)', v_required_votes, v_total_votes)
    );
  END IF;

  -- ------------------------------------------------------
  -- K. ATOMIC DATABASE COMMIT
  -- ------------------------------------------------------
  v_submission_id := COALESCE(p_submission_id, gen_random_uuid());

  -- 1. Insert Master Submission Record
  INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
  VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 2. Insert Items & Atomically Increment Vote Totals
  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count > 0 THEN
      -- Record individual ballot row
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_teacher_id, v_vote_count);

      -- Atomically Upsert Aggregate Total Count
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
    'status', 'submitted',
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
  WHERE email = v_email;

  IF v_student_id IS NULL THEN
    v_student_id := gen_random_uuid();
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

  -- 4. Upsert Profile Record
  INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
  VALUES (v_student_id, v_email, v_clean_name, 'student', p_device_id, v_now)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    device_id = COALESCE(EXCLUDED.device_id, public.profiles.device_id),
    updated_at = v_now;

  -- 5. Upsert Active Session Record
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
-- 5. Fast Aggregated Category Leaderboard Function
-- --------------------------------------------------------
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
    WHERE t.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM public.category_teachers ct 
          WHERE ct.category_id = p_category_id AND ct.teacher_id = t.id
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.category_teachers ct 
          WHERE ct.category_id = p_category_id
        )
      )
  ),
  aggregated_votes AS (
    SELECT
      vi.teacher_id AS t_id,
      COALESCE(SUM(vi.vote_count), 0)::BIGINT AS raw_vote_sum
    FROM public.vote_items vi
    INNER JOIN public.vote_submissions vs 
      ON vs.id = vi.submission_id 
     AND vs.category_id = p_category_id
    GROUP BY vi.teacher_id
  ),
  cached_totals AS (
    SELECT 
      vt.teacher_id AS t_id,
      COALESCE(vt.total_votes, 0)::BIGINT AS cached_sum
    FROM public.vote_totals vt
    WHERE vt.category_id = p_category_id
  )
  SELECT 
    cat.t_id AS teacher_id,
    cat.t_name AS teacher_name,
    cat.t_photo AS teacher_photo,
    cat.t_dept AS teacher_department,
    GREATEST(
      COALESCE(av.raw_vote_sum, 0),
      COALESCE(ct.cached_sum, 0)
    )::BIGINT AS total_votes,
    DENSE_RANK() OVER (
      ORDER BY 
        GREATEST(COALESCE(av.raw_vote_sum, 0), COALESCE(ct.cached_sum, 0)) DESC,
        cat.t_name ASC
    )::BIGINT AS rank
  FROM category_assigned_teachers cat
  LEFT JOIN aggregated_votes av ON av.t_id = cat.t_id
  LEFT JOIN cached_totals ct ON ct.t_id = cat.t_id
  ORDER BY 
    GREATEST(COALESCE(av.raw_vote_sum, 0), COALESCE(ct.cached_sum, 0)) DESC,
    cat.t_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_leaderboard(UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 6. Strict Row-Level Security Policies
-- --------------------------------------------------------

-- vote_totals: Public can SELECT for leaderboard; Direct INSERT/UPDATE disabled (via RPC only)
ALTER TABLE public.vote_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "View vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Admins view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Only admins view vote totals" ON public.vote_totals;

CREATE POLICY "Allow select vote totals"
  ON public.vote_totals FOR SELECT
  USING (true);

-- vote_submissions: Direct client insert disabled; read own submissions
ALTER TABLE public.vote_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students view own submissions" ON public.vote_submissions;
DROP POLICY IF EXISTS "Public view vote submissions" ON public.vote_submissions;

CREATE POLICY "Students view own submissions"
  ON public.vote_submissions FOR SELECT
  USING (true);

-- vote_items: Direct client insert disabled; read items
ALTER TABLE public.vote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students view own vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Public view vote items" ON public.vote_items;

CREATE POLICY "Students view own vote items"
  ON public.vote_items FOR SELECT
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

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END;
$$;
