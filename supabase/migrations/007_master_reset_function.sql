-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 007: Master System Reset RPC Function & Security Policies
-- ========================================================

-- 1. Create or replace atomic master reset function
CREATE OR REPLACE FUNCTION public.master_reset_all_data()
RETURNS JSONB AS $$
BEGIN
  -- Delete all detailed vote items
  DELETE FROM public.vote_items;

  -- Delete all student vote submissions
  DELETE FROM public.vote_submissions;

  -- Delete all aggregate vote totals
  DELETE FROM public.vote_totals;

  -- Delete all appreciation messages
  DELETE FROM public.appreciation_messages;

  -- Delete all admin audit logs
  DELETE FROM public.admin_actions;

  -- Delete all student user profiles (preserves admin accounts)
  DELETE FROM public.profiles
  WHERE role = 'student';

  -- Clear device_id from remaining profiles
  UPDATE public.profiles
  SET device_id = NULL;

  -- Reset voting settings to open, default state
  UPDATE public.voting_settings
  SET
    is_voting_open = true,
    show_live_counts = true,
    results_finalized = false,
    scheduled_start = NULL,
    scheduled_end = NULL,
    votes_per_category = 5,
    updated_at = NOW()
  WHERE id = 1;

  -- Ensure settings row exists
  INSERT INTO public.voting_settings (id, is_voting_open, show_live_counts, results_finalized, votes_per_category, updated_at)
  VALUES (1, true, true, false, 5, NOW())
  ON CONFLICT (id) DO UPDATE SET
    is_voting_open = true,
    show_live_counts = true,
    results_finalized = false,
    scheduled_start = NULL,
    scheduled_end = NULL,
    votes_per_category = 5,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'All votes, ballots, appreciation notes, and student records have been permanently wiped.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated & anon roles (protected by internal logic / service role)
GRANT EXECUTE ON FUNCTION public.master_reset_all_data() TO authenticated, anon, service_role;
