-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 011: High-Concurrency Optimization, Atomic Voting RPC & Security
-- Designed for 1,000+ Concurrent Users & High-Frequency Voting
-- ========================================================

-- Set lock timeout to avoid deadlocks
SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Clean Up Legacy Functions & Overloads (Pre-requisite for Return Type Changes)
-- --------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_votes(UUID, JSONB);
DROP FUNCTION IF EXISTS public.submit_votes(UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.submit_votes(UUID, JSONB, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_category_leaderboard(UUID);
DROP FUNCTION IF EXISTS public.verify_vote_integrity();

-- --------------------------------------------------------
-- 2. Master Atomic submit_votes RPC Function
-- Accepts:
--   - p_category_id: Target award category UUID
--   - p_votes: JSONB array of allocations [{ "teacher_id": "...", "vote_count": 3 }, ...]
--   - p_student_id: (Optional) Student UUID from session
--   - p_device_id: (Optional) Anti-abuse client device fingerprint
--   - p_submission_id: (Optional) Client-generated idempotency UUID
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_votes(
  p_category_id UUID,
  p_votes JSONB,
  p_student_id UUID DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_submission_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_student_id UUID;
  v_is_voting_open BOOLEAN;
  v_results_finalized BOOLEAN;
  v_scheduled_start TIMESTAMPTZ;
  v_scheduled_end TIMESTAMPTZ;
  v_category_active BOOLEAN;
  v_already_voted BOOLEAN;
  v_device_already_voted BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_elem JSONB;
  v_teacher_id UUID;
  v_vote_count INT;
  v_teacher_valid BOOLEAN;
  v_required_votes INT := 5;
  v_existing_sub_id UUID;
BEGIN
  -- A. Idempotency Check: If this exact submission UUID was already committed, return success
  IF p_submission_id IS NOT NULL THEN
    SELECT id INTO v_existing_sub_id
    FROM public.vote_submissions
    WHERE id = p_submission_id;

    IF v_existing_sub_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Your vote has been submitted successfully!',
        'submission_id', v_existing_sub_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- B. Resolve Student ID
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    IF p_student_id IS NOT NULL THEN
      v_student_id := p_student_id;
    ELSE
      RETURN jsonb_build_object('success', false, 'message', 'Authentication required. Please sign in to vote.');
    END IF;
  END IF;

  -- Ensure student profile exists in profiles table
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id) THEN
    INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
    VALUES (
      v_student_id,
      'student.' || SUBSTRING(v_student_id::TEXT, 1, 8) || '@student.college',
      'Student Voter',
      'student',
      p_device_id,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      device_id = COALESCE(EXCLUDED.device_id, public.profiles.device_id),
      updated_at = NOW();
  END IF;

  -- C. Validate Voting Settings
  SELECT is_voting_open, results_finalized, scheduled_start, scheduled_end, votes_per_category
  INTO v_is_voting_open, v_results_finalized, v_scheduled_start, v_scheduled_end, v_required_votes
  FROM public.voting_settings
  WHERE id = 1;

  IF NOT FOUND OR NOT v_is_voting_open THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting is currently closed by the administrator.');
  END IF;

  IF v_results_finalized THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting results have been finalized. No further submissions accepted.');
  END IF;

  IF v_scheduled_start IS NOT NULL AND NOW() < v_scheduled_start THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting has not opened yet.');
  END IF;

  IF v_scheduled_end IS NOT NULL AND NOW() > v_scheduled_end THEN
    RETURN jsonb_build_object('success', false, 'message', 'The voting period has ended.');
  END IF;

  -- D. Validate Category
  SELECT is_active INTO v_category_active
  FROM public.categories
  WHERE id = p_category_id;

  IF NOT FOUND OR NOT v_category_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or inactive category selected.');
  END IF;

  -- E. Duplicate Submission Check (Student + Category)
  SELECT EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE student_id = v_student_id AND category_id = p_category_id
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already submitted your vote for this category.');
  END IF;

  -- F. Anti-Abuse Check: Device ID uniqueness per category
  IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vote_submissions
      WHERE device_id = p_device_id
        AND category_id = p_category_id
        AND student_id <> v_student_id
    ) INTO v_device_already_voted;

    IF v_device_already_voted THEN
      RETURN jsonb_build_object('success', false, 'message', 'A vote has already been submitted for this category from this device.');
    END IF;
  END IF;

  -- G. Validate Votes Payload & Teacher Eligibility
  IF p_votes IS NULL OR jsonb_array_length(p_votes) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No vote allocations provided.');
  END IF;

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count IS NULL OR v_vote_count < 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Vote counts must be non-negative.');
    END IF;

    v_total_votes := v_total_votes + v_vote_count;

    IF v_vote_count > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.category_teachers ct
        JOIN public.teachers t ON t.id = ct.teacher_id
        WHERE ct.category_id = p_category_id
          AND ct.teacher_id = v_teacher_id
          AND t.is_active = true
      ) INTO v_teacher_valid;

      IF NOT v_teacher_valid THEN
        RETURN jsonb_build_object('success', false, 'message', 'One or more selected teachers are not eligible for this category.');
      END IF;
    END IF;
  END LOOP;

  -- H. Validate Exact Required Vote Total (e.g. 5)
  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Please allocate exactly %s votes. (Currently allocated: %s)', v_required_votes, v_total_votes)
    );
  END IF;

  -- ------------------------------------------------------
  -- ATOMIC TRANSACTION EXECUTION
  -- ------------------------------------------------------
  v_submission_id := COALESCE(p_submission_id, uuid_generate_v4());

  -- 1. Insert Vote Submission
  INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
  VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW());

  -- 2. Insert Vote Items (Bulk Insert)
  INSERT INTO public.vote_items (submission_id, teacher_id, vote_count, created_at)
  SELECT
    v_submission_id,
    (x->>'teacher_id')::UUID,
    (x->>'vote_count')::INT,
    NOW()
  FROM jsonb_array_elements(p_votes) AS x
  WHERE (x->>'vote_count')::INT > 0;

  -- 3. Atomic Increment of Aggregate Vote Totals
  INSERT INTO public.vote_totals (category_id, teacher_id, total_votes, updated_at)
  SELECT
    p_category_id,
    (x->>'teacher_id')::UUID,
    (x->>'vote_count')::INT,
    NOW()
  FROM jsonb_array_elements(p_votes) AS x
  WHERE (x->>'vote_count')::INT > 0
  ON CONFLICT (category_id, teacher_id)
  DO UPDATE SET
    total_votes = public.vote_totals.total_votes + EXCLUDED.total_votes,
    updated_at = NOW();

  -- 4. Return Atomic Transaction Result
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your vote has been submitted successfully!',
    'submission_id', v_submission_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already submitted your vote for this category.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Submission failed due to a database error. Please try again.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to all roles
GRANT EXECUTE ON FUNCTION public.submit_votes(UUID, JSONB, UUID, TEXT, UUID) TO authenticated, anon, service_role;


-- --------------------------------------------------------
-- 3. High-Performance Leaderboard Query RPC Function
-- Calculates ranks in PostgreSQL and returns minimal necessary data
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_leaderboard(p_category_id UUID)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_photo TEXT,
  teacher_department TEXT,
  total_votes INT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS teacher_id,
    t.name AS teacher_name,
    COALESCE(t.photo_url, '') AS teacher_photo,
    t.department AS teacher_department,
    COALESCE(vt.total_votes, 0)::INT AS total_votes,
    DENSE_RANK() OVER (ORDER BY COALESCE(vt.total_votes, 0) DESC, t.name ASC)::BIGINT AS rank
  FROM public.category_teachers ct
  JOIN public.teachers t ON t.id = ct.teacher_id
  LEFT JOIN public.vote_totals vt ON vt.category_id = p_category_id AND vt.teacher_id = t.id
  WHERE ct.category_id = p_category_id AND t.is_active = true
  ORDER BY total_votes DESC, t.name ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_category_leaderboard(UUID) TO authenticated, anon, service_role;


-- --------------------------------------------------------
-- 4. Database Integrity Verification & Health Diagnostic RPC
-- Compares vote_items sum vs vote_totals in an atomic diagnostic
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_vote_integrity()
RETURNS JSONB AS $$
DECLARE
  v_discrepancies INT := 0;
  v_total_submissions INT := 0;
  v_total_votes_items INT := 0;
  v_total_votes_totals INT := 0;
  v_unique_voters INT := 0;
  v_last_vote TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT student_id), MAX(submitted_at)
  INTO v_total_submissions, v_unique_voters, v_last_vote
  FROM public.vote_submissions;

  SELECT COALESCE(SUM(vote_count), 0)
  INTO v_total_votes_items
  FROM public.vote_items;

  SELECT COALESCE(SUM(total_votes), 0)
  INTO v_total_votes_totals
  FROM public.vote_totals;

  SELECT COUNT(*)
  INTO v_discrepancies
  FROM (
    SELECT
      COALESCE(vi_sum.category_id, vt.category_id) as category_id,
      COALESCE(vi_sum.teacher_id, vt.teacher_id) as teacher_id,
      COALESCE(vi_sum.item_votes, 0) as item_votes,
      COALESCE(vt.total_votes, 0) as total_votes
    FROM (
      SELECT vs.category_id, vi.teacher_id, SUM(vi.vote_count) as item_votes
      FROM public.vote_items vi
      JOIN public.vote_submissions vs ON vs.id = vi.submission_id
      GROUP BY vs.category_id, vi.teacher_id
    ) vi_sum
    FULL OUTER JOIN public.vote_totals vt
      ON vt.category_id = vi_sum.category_id AND vt.teacher_id = vi_sum.teacher_id
    WHERE COALESCE(vi_sum.item_votes, 0) <> COALESCE(vt.total_votes, 0)
  ) diff;

  RETURN jsonb_build_object(
    'is_healthy', (v_discrepancies = 0 AND v_total_votes_items = v_total_votes_totals),
    'discrepancies_count', v_discrepancies,
    'total_submissions', v_total_submissions,
    'total_votes_recorded', v_total_votes_totals,
    'total_votes_items', v_total_votes_items,
    'unique_voters', v_unique_voters,
    'last_vote_at', v_last_vote,
    'checked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.verify_vote_integrity() TO authenticated, anon, service_role;


-- --------------------------------------------------------
-- 5. Tighten RLS Security Policies on Voting Tables
-- Prevent arbitrary direct client-side total manipulation
-- --------------------------------------------------------

-- vote_totals: Public can SELECT only; modification ONLY via submit_votes RPC
DROP POLICY IF EXISTS "Public update vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "View vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
CREATE POLICY "Public view vote totals"
  ON public.vote_totals FOR SELECT
  USING (true);

-- vote_items: Public can SELECT only; inserts occur via RPC
DROP POLICY IF EXISTS "Public submit vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Public view vote items" ON public.vote_items;
CREATE POLICY "Public view vote items"
  ON public.vote_items FOR SELECT
  USING (true);

-- vote_submissions: Public can SELECT own or check submission status
DROP POLICY IF EXISTS "Public submit votes" ON public.vote_submissions;
DROP POLICY IF EXISTS "Public view vote submissions" ON public.vote_submissions;
CREATE POLICY "Public view vote submissions"
  ON public.vote_submissions FOR SELECT
  USING (true);


-- --------------------------------------------------------
-- 6. Performance Composite Indexes
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_category_teachers_cat_teacher ON public.category_teachers(category_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_vote_totals_cat_teacher ON public.vote_totals(category_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_vote_submissions_cat_student ON public.vote_submissions(category_id, student_id);
CREATE INDEX IF NOT EXISTS idx_vote_items_sub_teacher ON public.vote_items(submission_id, teacher_id);
