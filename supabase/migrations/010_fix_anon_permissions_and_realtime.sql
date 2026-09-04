-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 010: Fix Anon Roles RLS Permissions, Realtime & Storage
-- (Optimized & Deadlock-Free)
-- ========================================================

-- Set lock timeout to avoid blocking or deadlocks
SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Permissive SELECT Policies for Public/Anon & Authenticated Users
-- Students log in using their Full Name without Supabase Auth session JWTs,
-- so client queries run with `anon` role. All users must be able to view
-- active teachers, categories, assignments, live totals, and settings.
-- --------------------------------------------------------

-- Teachers Table
DROP POLICY IF EXISTS "Authenticated users view active teachers" ON public.teachers;
DROP POLICY IF EXISTS "Public view active teachers" ON public.teachers;
CREATE POLICY "Public view active teachers"
  ON public.teachers FOR SELECT
  USING (true);

-- Categories Table
DROP POLICY IF EXISTS "Authenticated users view active categories" ON public.categories;
DROP POLICY IF EXISTS "Public view active categories" ON public.categories;
CREATE POLICY "Public view active categories"
  ON public.categories FOR SELECT
  USING (true);

-- Category-Teacher Associations
DROP POLICY IF EXISTS "Authenticated users view category_teachers" ON public.category_teachers;
DROP POLICY IF EXISTS "Public view category_teachers" ON public.category_teachers;
CREATE POLICY "Public view category_teachers"
  ON public.category_teachers FOR SELECT
  USING (true);

-- Voting Settings Table
DROP POLICY IF EXISTS "View voting settings" ON public.voting_settings;
DROP POLICY IF EXISTS "Public view voting settings" ON public.voting_settings;
CREATE POLICY "Public view voting settings"
  ON public.voting_settings FOR SELECT
  USING (true);

-- Vote Totals (Leaderboard)
DROP POLICY IF EXISTS "View vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
CREATE POLICY "Public view vote totals"
  ON public.vote_totals FOR SELECT
  USING (true);

-- --------------------------------------------------------
-- 2. Profiles Table: Public / Student Registration Access
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public update profiles" ON public.profiles;

CREATE POLICY "Public access profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Public insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update profiles"
  ON public.profiles FOR UPDATE
  USING (true);

-- --------------------------------------------------------
-- 3. Vote Submissions, Items & Totals Permissions for Student Voting
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Public submit votes" ON public.vote_submissions;
CREATE POLICY "Public submit votes"
  ON public.vote_submissions FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public submit vote items" ON public.vote_items;
CREATE POLICY "Public submit vote items"
  ON public.vote_items FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public update vote totals" ON public.vote_totals;
CREATE POLICY "Public update vote totals"
  ON public.vote_totals FOR ALL
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------
-- 4. Supabase Storage Bucket for Teacher Photos
-- --------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-photos', 'teacher-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- --------------------------------------------------------
-- 5. Add Realtime Replication for Live Tables
-- --------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_totals;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_submissions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_settings;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
