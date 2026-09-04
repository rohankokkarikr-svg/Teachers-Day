-- ============================================================================
-- TEACHERS' DAY PLATFORM 2026: ONE-CLICK DATABASE SETUP FOR NEW PROJECT
-- Target Project: https://pkiuwdcjommlsjiwwyzk.supabase.co
-- Run this entire script in Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

SET lock_timeout = '10s';

-- --------------------------------------------------------
-- 1. FIX FOREIGN KEYS & PROFILES CONSTRAINT
-- Drop the auth.users foreign key constraint so student profiles can be created
-- --------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- --------------------------------------------------------
-- 2. ENSURE USER_SESSIONS TABLE & UNIQUE CONSTRAINT
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  device_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_device_id_key'
  ) THEN
    ALTER TABLE public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_device_id_key UNIQUE (user_id, device_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON public.user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device ON public.user_sessions(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active);

-- --------------------------------------------------------
-- 3. PERMISSIVE RLS POLICIES FOR ALL TABLES (ANON & AUTHENTICATED)
-- --------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appreciation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop all old restrictive policies
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public view active teachers" ON public.teachers;
DROP POLICY IF EXISTS "Public view active categories" ON public.categories;
DROP POLICY IF EXISTS "Public view category_teachers" ON public.category_teachers;
DROP POLICY IF EXISTS "Public view voting settings" ON public.voting_settings;
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public submit votes" ON public.vote_submissions;
DROP POLICY IF EXISTS "Public submit vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Public update vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public access appreciation" ON public.appreciation_messages;
DROP POLICY IF EXISTS "Public access admin actions" ON public.admin_actions;
DROP POLICY IF EXISTS "Public access user sessions" ON public.user_sessions;

-- Recreate clean permissive policies
CREATE POLICY "Public access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public view active teachers" ON public.teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public view active categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public view category_teachers" ON public.category_teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public view voting settings" ON public.voting_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public view vote totals" ON public.vote_totals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public submit votes" ON public.vote_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public submit vote items" ON public.vote_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access appreciation" ON public.appreciation_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access admin actions" ON public.admin_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access user sessions" ON public.user_sessions FOR ALL USING (true) WITH CHECK (true);

-- --------------------------------------------------------
-- 4. MASTER RPC: register_or_get_student (Type Compatible & Bulletproof)
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
    WHERE (user_id::TEXT = v_student_id::TEXT OR email = v_email OR (device_id = p_device_id AND p_device_id <> ''))
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
    id, user_id, full_name, email, role, device_id, user_agent, is_active, login_at, last_active_at, revoked_at
  )
  VALUES (
    gen_random_uuid(),
    v_student_id::TEXT,
    v_clean_name,
    v_email,
    'student',
    p_device_id,
    COALESCE(p_user_agent, 'Web Browser'),
    true,
    v_now,
    v_now,
    NULL
  )
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    user_agent = EXCLUDED.user_agent,
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
-- 5. MASTER RPC: submit_votes (Atomic & Zero Loss)
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
BEGIN
  -- 1. Idempotency Check
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

  -- 3. Check Revocation
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE (user_id::TEXT = v_student_id::TEXT OR (p_device_id IS NOT NULL AND p_device_id <> '' AND device_id = p_device_id))
      AND is_active = false
  ) INTO v_is_revoked;

  IF v_is_revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCOUNT_REVOKED',
      'message', 'Access Denied: Your account access has been restricted by the administrator.'
    );
  END IF;

  -- 4. Check Duplicate Vote in Category
  SELECT EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE (student_id = v_student_id OR (p_device_id IS NOT NULL AND p_device_id <> '' AND device_id = p_device_id))
      AND category_id = p_category_id
  ) INTO v_device_already_voted;

  IF v_device_already_voted THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DUPLICATE_SUBMISSION',
      'message', 'You have already submitted a vote for this category.'
    );
  END IF;

  -- 5. Check Global Voting Window
  SELECT is_voting_open, results_finalized, votes_per_category
  INTO v_is_voting_open, v_results_finalized, v_required_votes
  FROM public.voting_settings
  WHERE id = 1;

  IF v_is_voting_open IS FALSE OR v_results_finalized IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'Voting is currently closed by the administrator.'
    );
  END IF;

  -- 6. Check Category
  SELECT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id),
         EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id AND is_active = true)
  INTO v_category_exists, v_category_active;

  IF NOT v_category_exists OR NOT v_category_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CATEGORY_NOT_FOUND',
      'message', 'The selected category is not active or available for voting.'
    );
  END IF;

  -- 7. Validate Total Votes
  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_vote_count := COALESCE((v_vote_elem->>'vote_count')::INT, 0);
    IF v_vote_count > 0 THEN
      v_total_votes := v_total_votes + v_vote_count;
    END IF;
  END LOOP;

  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTE_LIMIT_EXCEEDED',
      'message', format('You must allocate exactly %s votes (received %s).', v_required_votes, v_total_votes)
    );
  END IF;

  -- 8. Transactional Insertion
  v_submission_id := COALESCE(p_submission_id, gen_random_uuid());

  INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
  VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW());

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count > 0 THEN
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_votes(UUID, JSONB, UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 6. REALTIME REPLICATION SETUP
-- --------------------------------------------------------
ALTER TABLE IF EXISTS public.vote_totals REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.vote_submissions REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.voting_settings REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.user_sessions REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.appreciation_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_totals; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_submissions; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_settings; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.appreciation_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;
