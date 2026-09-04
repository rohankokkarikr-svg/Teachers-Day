-- ============================================================================
-- MIGRATION 020: Fix user_sessions Type Compatibility & Session ID Generation
--
-- 1. Ensures user_sessions(user_id, device_id) unique constraint exists for atomic upserts.
-- 2. Fixes register_or_get_student() to explicitly cast UUID to TEXT (user_id = v_student_id::TEXT).
-- 3. Generates genuine UUIDs for user_sessions.id (gen_random_uuid()) instead of text string prefixes.
-- 4. Preserves all existing voting, admin authentication, and security constraints intact.
-- ============================================================================

-- --------------------------------------------------------
-- 1. Ensure user_sessions constraint and indexes
-- --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_device_id_key'
  ) THEN
    -- Clean up any historical duplicate sessions before adding unique constraint
    DELETE FROM public.user_sessions a
    USING public.user_sessions b
    WHERE a.ctid < b.ctid
      AND a.user_id = b.user_id
      AND a.device_id = b.device_id;

    ALTER TABLE public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_device_id_key UNIQUE (user_id, device_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device
  ON public.user_sessions(user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_heartbeat
  ON public.user_sessions(is_active, last_active_at DESC);

-- --------------------------------------------------------
-- 2. Corrected register_or_get_student() RPC
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

  -- 3. Check Revocation Status in user_sessions (explicit cast: user_id = v_student_id::TEXT)
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE (user_id = v_student_id::TEXT OR email = v_email OR (device_id = p_device_id AND p_device_id <> ''))
      AND is_active = false
  ) INTO v_is_revoked;

  IF v_is_revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCESS_REVOKED',
      'message', 'Access Denied: Your account access has been restricted by the administrator.'
    );
  END IF;

  -- 4. Upsert Active Session Record with valid UUID id and explicit TEXT user_id
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
