-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 003: Atomic Database RPC Functions
-- ========================================================

-- --------------------------------------------------------
-- 1. `submit_votes` — Core Atomic Voting Transaction Function
-- Accepts category_id and array of vote allocations: [{"teacher_id": "...", "vote_count": 3}, ...]
-- Performs 10 database-side validation checks before committing.
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_votes(
  p_category_id UUID,
  p_votes JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_student_id UUID;
  v_is_voting_open BOOLEAN;
  v_results_finalized BOOLEAN;
  v_category_active BOOLEAN;
  v_already_voted BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_record RECORD;
  v_teacher_valid BOOLEAN;
  v_required_votes INT := 5;
BEGIN
  -- 1. Authenticated User Check
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required. Please sign in.');
  END IF;

  -- 2. Verify Voting Settings Status
  SELECT is_voting_open, results_finalized, votes_per_category
  INTO v_is_voting_open, v_results_finalized, v_required_votes
  FROM public.voting_settings
  WHERE id = 1;

  IF NOT FOUND OR NOT v_is_voting_open THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting is currently closed by the administrator.');
  END IF;

  IF v_results_finalized THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting results have been finalized. No further submissions accepted.');
  END IF;

  -- 3. Verify Category Exists and is Active
  SELECT is_active INTO v_category_active
  FROM public.categories
  WHERE id = p_category_id;

  IF NOT FOUND OR NOT v_category_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or inactive category selected.');
  END IF;

  -- 4. Check for Existing Duplicate Submission (Student + Category)
  SELECT EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE student_id = v_student_id AND category_id = p_category_id
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already submitted your vote for this category.');
  END IF;

  -- 5. Calculate Total Allocated Votes and Check Non-negative Values
  FOR v_vote_record IN SELECT * FROM jsonb_to_recordset(p_votes) AS x(teacher_id UUID, vote_count INT)
  LOOP
    IF v_vote_record.vote_count IS NULL OR v_vote_record.vote_count < 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Vote counts must be positive numbers.');
    END IF;

    -- Ignore 0-vote allocations in storage but add to total check
    v_total_votes := v_total_votes + v_vote_record.vote_count;

    -- 6. Verify Teacher belongs to this Category and is Active
    IF v_vote_record.vote_count > 0 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.category_teachers ct
        JOIN public.teachers t ON t.id = ct.teacher_id
        WHERE ct.category_id = p_category_id
          AND ct.teacher_id = v_vote_record.teacher_id
          AND t.is_active = true
      ) INTO v_teacher_valid;

      IF NOT v_teacher_valid THEN
        RETURN jsonb_build_object('success', false, 'message', 'One or more selected teachers are not eligible for this category.');
      END IF;
    END IF;
  END LOOP;

  -- 7. Validate Total Allocated Votes equals exactly required (5)
  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Please allocate exactly %s votes. (Currently allocated: %s)', v_required_votes, v_total_votes)
    );
  END IF;

  -- ------------------------------------------------------
  -- ATOMIC TRANSACTION COMMIT
  -- ------------------------------------------------------
  -- 8. Insert Submission Record
  INSERT INTO public.vote_submissions (student_id, category_id)
  VALUES (v_student_id, p_category_id)
  RETURNING id INTO v_submission_id;

  -- 9. Insert Vote Items and Update Aggregate Vote Totals
  FOR v_vote_record IN SELECT * FROM jsonb_to_recordset(p_votes) AS x(teacher_id UUID, vote_count INT)
  LOOP
    IF v_vote_record.vote_count > 0 THEN
      -- Insert detailed vote item
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_vote_record.teacher_id, v_vote_record.vote_count);

      -- Update materialized vote total (Atomic Increment)
      INSERT INTO public.vote_totals (category_id, teacher_id, total_votes)
      VALUES (p_category_id, v_vote_record.teacher_id, v_vote_record.vote_count)
      ON CONFLICT (category_id, teacher_id)
      DO UPDATE SET
        total_votes = public.vote_totals.total_votes + EXCLUDED.total_votes,
        updated_at = NOW();
    END IF;
  END LOOP;

  -- 10. Return Success
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


-- --------------------------------------------------------
-- 2. Leaderboard Query Function
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_leaderboard(p_category_id UUID)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_photo TEXT,
  department TEXT,
  total_votes INT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS teacher_id,
    t.name AS teacher_name,
    t.photo_url AS teacher_photo,
    t.department AS department,
    COALESCE(vt.total_votes, 0) AS total_votes,
    RANK() OVER (ORDER BY COALESCE(vt.total_votes, 0) DESC) AS rank
  FROM public.category_teachers ct
  JOIN public.teachers t ON t.id = ct.teacher_id
  LEFT JOIN public.vote_totals vt ON vt.category_id = p_category_id AND vt.teacher_id = t.id
  WHERE ct.category_id = p_category_id AND t.is_active = true
  ORDER BY total_votes DESC, t.name ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- --------------------------------------------------------
-- 3. Admin Recalculate Totals Function (Disaster Recovery)
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_vote_totals()
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Truncate vote totals table
  DELETE FROM public.vote_totals;

  -- Re-aggregate from raw vote items
  INSERT INTO public.vote_totals (category_id, teacher_id, total_votes)
  SELECT
    vs.category_id,
    vi.teacher_id,
    SUM(vi.vote_count)::INT AS total_votes
  FROM public.vote_items vi
  JOIN public.vote_submissions vs ON vs.id = vi.submission_id
  GROUP BY vs.category_id, vi.teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
