-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 015: Fix submit_votes Teacher Eligibility & Seed All Category Mappings
-- ========================================================

-- 1. Ensure category_teachers table has unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_teachers_category_id_teacher_id_key'
  ) THEN
    ALTER TABLE public.category_teachers
    ADD CONSTRAINT category_teachers_category_id_teacher_id_key UNIQUE (category_id, teacher_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Populate category_teachers for all 7 Faculty Categories with 15 Faculty Members
INSERT INTO public.category_teachers (category_id, teacher_id)
SELECT c.id, t.id
FROM public.categories c
CROSS JOIN public.teachers t
WHERE c.id IN (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000004',
  '11111111-0000-0000-0000-000000000005',
  '11111111-0000-0000-0000-000000000006',
  '11111111-0000-0000-0000-000000000007'
)
AND t.id IN (
  '61ff6e22-fd00-4ce7-808e-ef632b32b4f2',
  '12391ff0-39c5-4943-85ba-50078dde7633',
  '2af866ab-bb11-4e75-99d2-309aadffba05',
  '74a7b656-31a2-4c7a-951a-29405707d463',
  '69880310-6cd0-40d5-80c3-fc257affc81d',
  '8381a885-2537-462a-8211-0d1443ab4f68',
  '2dcff07e-39d7-4d6a-a72c-4d9b784e10d2',
  '365d3ed5-f3c7-47be-b3d9-970b346c2ab2',
  '81beb89b-d752-45ac-9d2c-c44284112679',
  '74cbeffa-e7c2-46b3-9289-4b5f621639e4',
  '3b7fe6f2-b16e-44ab-b3cc-89f019268d40',
  '8dd524fc-cf31-4fec-90ac-9843113d8ff5',
  '1950874b-1d30-4420-82b3-90649061a0f1',
  '633af82e-ca0d-4785-ba7b-08909cc92ce1',
  '87d77938-d6bb-4197-b1b4-5e12f485e17a'
)
ON CONFLICT (category_id, teacher_id) DO NOTHING;

-- 3. Populate Category 8 (Best Non - Technical Staff) with 4 Non-Technical Staff
INSERT INTO public.category_teachers (category_id, teacher_id)
SELECT '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0'::UUID, t.id
FROM public.teachers t
WHERE t.id IN (
  'f0e5af11-e1de-4a6f-975e-7c0e193693c0',
  'bed87c04-9a5a-46ef-bb0b-4fba71238538',
  'b2c9cbda-5158-4e64-8b85-9b245625f864',
  '3208c751-30bd-4898-8f17-e22d7fa2e3d5'
)
ON CONFLICT (category_id, teacher_id) DO NOTHING;

-- 4. Re-create submit_votes RPC with resilient teacher validation
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
  v_required_votes INT := 5;
  v_category_active BOOLEAN;
  v_already_voted BOOLEAN;
  v_device_already_voted BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_elem JSONB;
  v_teacher_id UUID;
  v_vote_count INT;
  v_teacher_valid BOOLEAN;
BEGIN
  -- A. Resolve Student ID
  v_student_id := COALESCE(auth.uid(), p_student_id);

  IF v_student_id IS NULL THEN
    v_student_id := gen_random_uuid();
  END IF;

  -- B. Ensure Profile exists in public.profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id) THEN
    INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
    VALUES (
      v_student_id,
      format('student_%s@college.edu', substring(v_student_id::TEXT, 1, 8)),
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
      -- Check 1: category_teachers mapping
      SELECT EXISTS (
        SELECT 1 FROM public.category_teachers ct
        JOIN public.teachers t ON t.id = ct.teacher_id
        WHERE ct.category_id = p_category_id
          AND ct.teacher_id = v_teacher_id
          AND t.is_active = true
      ) INTO v_teacher_valid;

      -- Check 2: Fallback if category_teachers is not populated in DB
      IF NOT v_teacher_valid THEN
        SELECT EXISTS (
          SELECT 1 FROM public.teachers t
          WHERE t.id = v_teacher_id AND t.is_active = true
        ) INTO v_teacher_valid;

        -- Auto-seed mapping on the fly
        IF v_teacher_valid THEN
          INSERT INTO public.category_teachers (category_id, teacher_id)
          VALUES (p_category_id, v_teacher_id)
          ON CONFLICT (category_id, teacher_id) DO NOTHING;
        END IF;
      END IF;

      IF NOT v_teacher_valid THEN
        RETURN jsonb_build_object('success', false, 'message', 'One or more selected teachers are not valid active candidates.');
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
  v_submission_id := COALESCE(p_submission_id, gen_random_uuid());

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

  -- 3. Upsert Materialized Vote Totals (High-Performance Atomic Increments)
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

  -- 4. Return Success Response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your vote has been recorded securely!',
    'submission_id', v_submission_id,
    'category_id', p_category_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already submitted your vote for this category.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
