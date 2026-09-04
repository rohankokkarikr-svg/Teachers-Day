-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 016: Strict Access Control & Session Reactivation
-- ========================================================

-- 1. Add is_active and revoked_at to public.profiles table if not present
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_revoked_at ON public.profiles(revoked_at);

-- 2. Ensure user_sessions table has all necessary lookup indexes
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

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON public.user_sessions(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON public.user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked_at ON public.user_sessions(revoked_at);

-- 3. RLS Policies for user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_sessions_select_policy" ON public.user_sessions;
CREATE POLICY "user_sessions_select_policy" ON public.user_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_sessions_insert_policy" ON public.user_sessions;
CREATE POLICY "user_sessions_insert_policy" ON public.user_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "user_sessions_update_policy" ON public.user_sessions;
CREATE POLICY "user_sessions_update_policy" ON public.user_sessions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_sessions_delete_policy" ON public.user_sessions;
CREATE POLICY "user_sessions_delete_policy" ON public.user_sessions FOR DELETE USING (true);

-- 4. RPC function: Revoke specific user sessions & profiles
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(
  p_user_ids TEXT[],
  p_device_ids TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  -- Update user_sessions
  UPDATE public.user_sessions
  SET
    is_active = false,
    revoked_at = NOW()
  WHERE
    (user_id = ANY(p_user_ids) OR (array_length(p_device_ids, 1) > 0 AND device_id = ANY(p_device_ids)))
    AND is_active = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Update profiles
  UPDATE public.profiles
  SET
    is_active = false,
    revoked_at = NOW()
  WHERE
    id::text = ANY(p_user_ids)
    OR (array_length(p_device_ids, 1) > 0 AND device_id = ANY(p_device_ids));

  RETURN jsonb_build_object(
    'success', true,
    'revoked_count', v_updated_count,
    'revoked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC function: Revoke all student sessions (Logout All)
CREATE OR REPLACE FUNCTION public.revoke_all_student_sessions()
RETURNS JSONB AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  UPDATE public.user_sessions
  SET
    is_active = false,
    revoked_at = NOW()
  WHERE
    role = 'student'
    AND is_active = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.profiles
  SET
    is_active = false,
    revoked_at = NOW()
  WHERE
    role = 'student';

  RETURN jsonb_build_object(
    'success', true,
    'revoked_count', v_updated_count,
    'revoked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC function: Reactivate specific user sessions & profiles (Admin grants access)
CREATE OR REPLACE FUNCTION public.reactivate_user_sessions(
  p_user_ids TEXT[]
)
RETURNS JSONB AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  UPDATE public.user_sessions
  SET
    is_active = true,
    revoked_at = NULL,
    last_active_at = NOW()
  WHERE
    user_id = ANY(p_user_ids);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.profiles
  SET
    is_active = true,
    revoked_at = NULL
  WHERE
    id::text = ANY(p_user_ids);

  RETURN jsonb_build_object(
    'success', true,
    'reactivated_count', v_updated_count,
    'reactivated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
