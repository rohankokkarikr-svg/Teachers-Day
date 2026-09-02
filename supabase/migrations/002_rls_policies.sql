-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 002: Row Level Security (RLS) Policies
-- ========================================================

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appreciation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current authenticated user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- 1. Profiles RLS
-- --------------------------------------------------------
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admins can view all profiles
CREATE POLICY "Admins full access profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- --------------------------------------------------------
-- 2. Teachers RLS
-- --------------------------------------------------------
-- Authenticated users can view active teachers
CREATE POLICY "Authenticated users view active teachers"
  ON public.teachers FOR SELECT
  USING (auth.role() = 'authenticated' AND (is_active = true OR public.is_admin()));

-- Admins full access teachers
CREATE POLICY "Admins full access teachers"
  ON public.teachers FOR ALL
  USING (public.is_admin());

-- --------------------------------------------------------
-- 3. Categories RLS
-- --------------------------------------------------------
-- Authenticated users view active categories
CREATE POLICY "Authenticated users view active categories"
  ON public.categories FOR SELECT
  USING (auth.role() = 'authenticated' AND (is_active = true OR public.is_admin()));

-- Admins full access categories
CREATE POLICY "Admins full access categories"
  ON public.categories FOR ALL
  USING (public.is_admin());

-- --------------------------------------------------------
-- 4. Category-Teacher Association RLS
-- --------------------------------------------------------
CREATE POLICY "Authenticated users view category_teachers"
  ON public.category_teachers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins full access category_teachers"
  ON public.category_teachers FOR ALL
  USING (public.is_admin());

-- --------------------------------------------------------
-- 5. Vote Submissions RLS
-- Direct INSERT disabled for clients — Inserts MUST be performed via `submit_votes` RPC
-- --------------------------------------------------------
CREATE POLICY "Students view own submissions"
  ON public.vote_submissions FOR SELECT
  USING (student_id = auth.uid() OR public.is_admin());

-- --------------------------------------------------------
-- 6. Vote Items RLS
-- Direct INSERT disabled for clients — Inserts MUST be performed via `submit_votes` RPC
-- --------------------------------------------------------
CREATE POLICY "Students view own vote items"
  ON public.vote_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vote_submissions s
      WHERE s.id = submission_id AND (s.student_id = auth.uid() OR public.is_admin())
    )
  );

-- --------------------------------------------------------
-- 7. Vote Totals RLS
-- Public leaderboard read (respects show_live_counts setting or admin override)
-- --------------------------------------------------------
CREATE POLICY "View vote totals"
  ON public.vote_totals FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      (SELECT show_live_counts FROM public.voting_settings WHERE id = 1) = true
      OR public.is_admin()
    )
  );

-- --------------------------------------------------------
-- 8. Appreciation Messages RLS
-- --------------------------------------------------------
-- Students can insert their own messages
CREATE POLICY "Students insert appreciation"
  ON public.appreciation_messages FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Everyone can view approved/featured messages; Students view own; Admins view all
CREATE POLICY "View appreciation messages"
  ON public.appreciation_messages FOR SELECT
  USING (
    status IN ('approved', 'featured')
    OR student_id = auth.uid()
    OR public.is_admin()
  );

-- Admins full access appreciation messages
CREATE POLICY "Admins full access appreciation"
  ON public.appreciation_messages FOR ALL
  USING (public.is_admin());

-- --------------------------------------------------------
-- 9. Voting Settings RLS
-- --------------------------------------------------------
CREATE POLICY "View voting settings"
  ON public.voting_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins update voting settings"
  ON public.voting_settings FOR ALL
  USING (public.is_admin());

-- --------------------------------------------------------
-- 10. Admin Audit Log RLS
-- --------------------------------------------------------
CREATE POLICY "Admins access audit log"
  ON public.admin_actions FOR ALL
  USING (public.is_admin());
