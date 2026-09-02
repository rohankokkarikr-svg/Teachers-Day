-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 001: Initial PostgreSQL Database Schema
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom Enum Types
CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE message_status AS ENUM ('pending', 'approved', 'rejected', 'featured');

-- --------------------------------------------------------
-- 1. Profiles Table (extends Supabase auth.users)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- 2. Teachers Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  subject TEXT,
  photo_url TEXT,
  tagline TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- 3. Categories Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- 4. Category-Teacher Association (Many-to-Many)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_category_teacher UNIQUE (category_id, teacher_id)
);

-- --------------------------------------------------------
-- 5. Vote Submissions Table (One per student per category)
-- CRITICAL SECURITY RULE: Database-level uniqueness on (student_id, category_id)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_student_category_vote UNIQUE (student_id, category_id)
);

-- --------------------------------------------------------
-- 6. Vote Items Table (Atomically stored per submission)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES public.vote_submissions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  vote_count INT NOT NULL CHECK (vote_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- 7. Vote Totals Table (Materialized aggregate for fast Realtime & Leaderboard)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_totals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  total_votes INT NOT NULL DEFAULT 0 CHECK (total_votes >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_category_teacher_total UNIQUE (category_id, teacher_id)
);

-- --------------------------------------------------------
-- 8. Appreciation Messages Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appreciation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK (char_length(message) >= 5 AND char_length(message) <= 280),
  status message_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- 9. Voting Settings Table (Singleton Configuration)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voting_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_voting_open BOOLEAN NOT NULL DEFAULT false,
  show_live_counts BOOLEAN NOT NULL DEFAULT true,
  results_finalized BOOLEAN NOT NULL DEFAULT false,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  votes_per_category INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial singleton configuration
INSERT INTO public.voting_settings (id, is_voting_open, show_live_counts, results_finalized)
VALUES (1, true, true, false)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------
-- 10. Admin Audit Log Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- INDEXES FOR HIGH-CONCURRENCY PERFORMANCE & QUERY OPTIMIZATION
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_teachers_is_active ON public.teachers(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display ON public.categories(display_order, is_active);
CREATE INDEX IF NOT EXISTS idx_category_teachers_cat ON public.category_teachers(category_id);
CREATE INDEX IF NOT EXISTS idx_category_teachers_teacher ON public.category_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_vote_submissions_student_cat ON public.vote_submissions(student_id, category_id);
CREATE INDEX IF NOT EXISTS idx_vote_items_submission ON public.vote_items(submission_id);
CREATE INDEX IF NOT EXISTS idx_vote_totals_cat_votes ON public.vote_totals(category_id, total_votes DESC);
CREATE INDEX IF NOT EXISTS idx_appreciation_status ON public.appreciation_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);

-- Automatically update `updated_at` column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE OR REPLACE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_teachers_modtime
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_categories_modtime
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_appreciation_modtime
  BEFORE UPDATE ON public.appreciation_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
