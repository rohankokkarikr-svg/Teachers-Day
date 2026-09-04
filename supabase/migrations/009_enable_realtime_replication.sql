-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 009: Realtime Publication & CDC Replication Setup
-- ========================================================

-- Enable REPLICA IDENTITY FULL for instant change tracking
ALTER TABLE IF EXISTS public.vote_totals REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.vote_submissions REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.voting_settings REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.appreciation_messages REPLICA IDENTITY FULL;

-- Ensure supabase_realtime publication contains active live tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Add vote_totals
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_totals;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication
    END;

    -- Add vote_submissions
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_submissions;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication
    END;

    -- Add voting_settings
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_settings;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication
    END;

    -- Add appreciation_messages
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.appreciation_messages;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication
    END;
  END IF;
END $$;
