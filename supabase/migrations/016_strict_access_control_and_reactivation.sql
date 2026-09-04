-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 016: Strict Access Control & Session Reactivation
-- ========================================================

-- 1. Ensure user_sessions table has all necessary lookup indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON public.user_sessions(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked_at ON public.user_sessions(revoked_at);

-- 2. RPC function: Reactivate specific user sessions (Admin grants access)
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

  RETURN jsonb_build_object(
    'success', true,
    'reactivated_count', v_updated_count,
    'reactivated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC function: Check if a user or device is restricted from logging in
CREATE OR REPLACE FUNCTION public.check_user_access_status(
  p_user_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_is_revoked BOOLEAN := false;
  v_revoked_record RECORD;
BEGIN
  SELECT id, user_id, email, is_active, revoked_at
  INTO v_revoked_record
  FROM public.user_sessions
  WHERE
    (
      (p_user_id IS NOT NULL AND user_id = p_user_id) OR
      (p_email IS NOT NULL AND email ILIKE p_email) OR
      (p_device_id IS NOT NULL AND device_id = p_device_id)
    )
    AND (is_active = false OR revoked_at IS NOT NULL)
  ORDER BY revoked_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    v_is_revoked := true;
  END IF;

  RETURN jsonb_build_object(
    'allowed', NOT v_is_revoked,
    'is_revoked', v_is_revoked,
    'checked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
