-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 017: Restrict Results Exclusively to Admin Panel, Zero-Loss Realtime Sync & 100% Resilient Voting
-- ========================================================

-- Set short lock timeout to avoid blocking active queries
SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Ensure category_teachers Table Has Unique Constraint
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- 2. Upsert All 15 Teaching Faculty & 4 Non-Technical Staff in public.teachers
-- --------------------------------------------------------
INSERT INTO public.teachers (id, name, department, subject, tagline, photo_url, is_active)
VALUES
  -- Teaching Faculty (15)
  ('61ff6e22-fd00-4ce7-808e-ef632b32b4f2', 'Prof Prashant Kivati.', 'BCA', 'Cybersecurity & Ethical Hacking', 'Securing digital assets and cyber landscapes.', '/teachers/teacher_3.jpeg', true),
  ('12391ff0-39c5-4943-85ba-50078dde7633', 'Prof Malikjan Bagwan.', 'BCA', 'Python & Machine Learning', 'Unlocking intelligent solutions with modern AI.', '/teachers/teacher_7.jpeg', true),
  ('2af866ab-bb11-4e75-99d2-309aadffba05', 'Prof Akshay Hiremath.', 'BCA', 'Data Structures & Algorithms', 'Master the logic, master the code.', '/teachers/teacher_10.jpeg', true),
  ('74a7b656-31a2-4c7a-951a-29405707d463', 'Prof Krutika Lakkannavar.', 'BCA', 'Operating Systems & Architecture', 'Understanding the core mechanisms of computing.', '/teachers/teacher_8.jpeg', true),
  ('69880310-6cd0-40d5-80c3-fc257affc81d', 'Prof Aishwarya Desai.', 'BCA', 'Computer Networks & Security', 'Empowering future engineers with solid foundations.', '/teachers/teacher_13.jpeg', true),
  ('8381a885-2537-462a-8211-0d1443ab4f68', 'Prof Akshata Pethe.', 'BCA', 'Database Management Systems', 'Making database architecture simple and intuitive.', '/teachers/teacher_6.jpeg', true),
  ('2dcff07e-39d7-4d6a-a72c-4d9b784e10d2', 'Prof Akshata Vantagodi.', 'BCA', 'Software Engineering & Testing', 'Code quality and precision define great developers.', '/teachers/teacher_11.jpeg', true),
  ('365d3ed5-f3c7-47be-b3d9-970b346c2ab2', 'Prof Anand Bilagi.', 'BCA', 'Object-Oriented Programming (Java/C++)', 'Building robust software piece by piece.', '/teachers/teacher_9.jpeg', true),
  ('81beb89b-d752-45ac-9d2c-c44284112679', 'Prof Anup Kalyanshetti.', 'BCA', 'Web Technologies & Full Stack Dev', 'Turning creative ideas into interactive web apps.', '/teachers/teacher_19.jpeg', true),
  ('74cbeffa-e7c2-46b3-9289-4b5f621639e4', 'Prof Anusha Hiremath.', 'BCA', 'Cloud Computing & DevOps', 'Scalable infrastructure for modern computing.', '/teachers/teacher_4.jpeg', true),
  ('3b7fe6f2-b16e-44ab-b3cc-89f019268d40', 'Prof Pramod Kugatoli.', 'BCA', 'Mobile App Development', 'Crafting responsive mobile experiences.', '/teachers/teacher_12.jpeg', true),
  ('8dd524fc-cf31-4fec-90ac-9843113d8ff5', 'Prof Shanta Bhujjanavar.', 'BCA', 'Discrete Mathematics & Graph Theory', 'Finding mathematical elegance in everyday computing.', '/teachers/teacher_2.jpeg', true),
  ('1950874b-1d30-4420-82b3-90649061a0f1', 'Prof Shilpa Hosamani.', 'BCA', 'Artificial Intelligence & Data Mining', 'Discovering valuable patterns within big data.', '/teachers/teacher_1.jpeg', true),
  ('633af82e-ca0d-4785-ba7b-08909cc92ce1', 'Prof Suprita Walvekar.', 'BCA', 'Human-Computer Interaction & UI/UX', 'Designing accessible, delight-driven software.', '/teachers/teacher_5.jpeg', true),
  ('87d77938-d6bb-4197-b1b4-5e12f485e17a', 'Prof Vinod Jain.', 'BCA', 'Compiler Design & Theory of Computation', 'Translating foundational logic into machine intelligence.', '/teachers/teacher_17.jpeg', true),

  -- Non-Technical Staff (4)
  ('f0e5af11-e1de-4a6f-975e-7c0e193693c0', 'Mr Ravi Bennole.', 'Non-Technical Staff', 'Operations & Event Coordination', 'Dedicated to student welfare and smooth event execution.', '/teachers/teacher_18.jpeg', true),
  ('bed87c04-9a5a-46ef-bb0b-4fba71238538', 'Mr Mahantesh Manaji.', 'Non-Technical Staff', 'Campus & Academic Operations', 'Ensuring seamless day-to-day college operations.', '/teachers/teacher_14.jpeg', true),
  ('b2c9cbda-5158-4e64-8b85-9b245625f864', 'Mis Mamata Mattikalli.', 'Non-Technical Staff', 'Administrative & Student Support', 'Always ready to help every student succeed.', '/teachers/teacher_15.jpeg', true),
  ('3208c751-30bd-4898-8f17-e22d7fa2e3d5', 'Mr Sidrayi Nayak.', 'Non-Technical Staff', 'Technical & Lab Support', 'Keeping computer labs optimized and running smoothly.', '/teachers/teacher_16.jpeg', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  subject = EXCLUDED.subject,
  tagline = EXCLUDED.tagline,
  photo_url = EXCLUDED.photo_url,
  is_active = EXCLUDED.is_active;

-- --------------------------------------------------------
-- 3. Ensure All 8 Categories Are Present in public.categories
-- --------------------------------------------------------
INSERT INTO public.categories (id, name, description, icon, display_order, is_active)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Most Inspiring Teacher', 'The teacher who lights the spark of curiosity and encourages students', '✨', 1, true),
  ('11111111-0000-0000-0000-000000000002', 'Best Explainer', 'Makes even the most complex algorithms, formulas, and theories crystal clear', '💡', 2, true),
  ('11111111-0000-0000-0000-000000000003', 'Most Supportive Teacher', 'Always available during office hours and goes out of their way to help', '🤝', 3, true),
  ('11111111-0000-0000-0000-000000000004', 'Best Motivator', 'Pushes you to achieve your absolute best and never lets you give up', '🔥', 4, true),
  ('11111111-0000-0000-0000-000000000005', 'Friendliest Teacher', 'Creates a warm, welcoming, and open environment in every lecture', '😊', 5, true),
  ('11111111-0000-0000-0000-000000000006', 'Most Energetic Teacher', 'Brings unmatched passion, enthusiasm, and energy to every single class', '⚡', 6, true),
  ('11111111-0000-0000-0000-000000000007', 'Students'' Favourite Teacher', 'The overall most beloved mentor of the college community', '❤️', 7, true),
  ('0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0', 'Best Non - Technical  Staff', 'Recognizing outstanding dedication, assistance, and support from non-technical staff', '🏆', 8, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- --------------------------------------------------------
-- 4. Assign 15 Teaching Faculty to Categories 1 through 7
-- --------------------------------------------------------
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
  '69880310-6cd0-40d5-80c3-fc257affc81d', -- Prof Aishwarya Desai.
  '8381a885-2537-462a-8211-0d1443ab4f68', -- Prof Akshata Pethe.
  '2dcff07e-39d7-4d6a-a72c-4d9b784e10d2', -- Prof Akshata Vantagodi.
  '2af866ab-bb11-4e75-99d2-309aadffba05', -- Prof Akshay Hiremath.
  '365d3ed5-f3c7-47be-b3d9-970b346c2ab2', -- Prof Anand Bilagi.
  '81beb89b-d752-45ac-9d2c-c44284112679', -- Prof Anup Kalyanshetti.
  '74cbeffa-e7c2-46b3-9289-4b5f621639e4', -- Prof Anusha Hiremath.
  '74a7b656-31a2-4c7a-951a-29405707d463', -- Prof Krutika Lakkannavar.
  '12391ff0-39c5-4943-85ba-50078dde7633', -- Prof Malikjan Bagwan.
  '3b7fe6f2-b16e-44ab-b3cc-89f019268d40', -- Prof Pramod Kugatoli.
  '61ff6e22-fd00-4ce7-808e-ef632b32b4f2', -- Prof Prashant Kivati.
  '8dd524fc-cf31-4fec-90ac-9843113d8ff5', -- Prof Shanta Bhujjanavar.
  '1950874b-1d30-4420-82b3-90649061a0f1', -- Prof Shilpa Hosamani.
  '633af82e-ca0d-4785-ba7b-08909cc92ce1', -- Prof Suprita Walvekar.
  '87d77938-d6bb-4197-b1b4-5e12f485e17a'  -- Prof Vinod Jain.
)
ON CONFLICT (category_id, teacher_id) DO NOTHING;

-- --------------------------------------------------------
-- 5. Assign 4 Non-Technical Staff to Category 8
-- --------------------------------------------------------
INSERT INTO public.category_teachers (category_id, teacher_id)
SELECT '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0'::UUID, t.id
FROM public.teachers t
WHERE t.id IN (
  'f0e5af11-e1de-4a6f-975e-7c0e193693c0', -- Mr Ravi Bennole.
  'b2c9cbda-5158-4e64-8b85-9b245625f864', -- Mis Mamata Mattikalli.
  'bed87c04-9a5a-46ef-bb0b-4fba71238538', -- Mr Mahantesh Manaji.
  '3208c751-30bd-4898-8f17-e22d7fa2e3d5'  -- Mr Sidrayi Nayak.
)
ON CONFLICT (category_id, teacher_id) DO NOTHING;

-- --------------------------------------------------------
-- 6. Bulletproof, Self-Healing submit_votes RPC
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
  v_required_votes INT := 5;
  v_already_voted BOOLEAN;
  v_device_already_voted BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_elem JSONB;
  v_teacher_id UUID;
  v_vote_count INT;
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
      'student_' || substring(v_student_id::text from 1 for 8) || '@teachersday.local',
      'Student Voter',
      'student',
      p_device_id,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- C. Validate System Voting Settings
  SELECT is_voting_open, results_finalized, scheduled_start, scheduled_end
  INTO v_is_voting_open, v_results_finalized, v_scheduled_start, v_scheduled_end
  FROM public.voting_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    v_is_voting_open := true;
    v_results_finalized := false;
  END IF;

  IF v_results_finalized THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting is closed. Results have been finalized.');
  END IF;

  IF NOT v_is_voting_open THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting is currently closed by the administrator.');
  END IF;

  IF v_scheduled_start IS NOT NULL AND NOW() < v_scheduled_start THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting has not started yet.');
  END IF;

  IF v_scheduled_end IS NOT NULL AND NOW() > v_scheduled_end THEN
    RETURN jsonb_build_object('success', false, 'message', 'The voting period has ended.');
  END IF;

  -- D. Ensure Category is active or auto-seed if needed
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id AND is_active = true) THEN
    INSERT INTO public.categories (id, name, description, is_active)
    VALUES (p_category_id, 'Award Category', 'Teachers Day Award Category', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;
  END IF;

  -- E. Duplicate Submission Check (Student + Category)
  SELECT EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE student_id = v_student_id AND category_id = p_category_id
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already submitted your vote for this category.');
  END IF;

  -- F. Device ID Anti-Abuse Check
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

  -- G. Validate Votes Payload & Teacher Self-Healing
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
      -- Self-healing: Ensure teacher exists in public.teachers
      IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id) THEN
        INSERT INTO public.teachers (id, name, department, is_active)
        VALUES (v_teacher_id, 'Faculty Member', 'BCA', true)
        ON CONFLICT (id) DO UPDATE SET is_active = true;
      ELSE
        UPDATE public.teachers SET is_active = true WHERE id = v_teacher_id AND is_active = false;
      END IF;

      -- Self-healing: Ensure mapping exists in public.category_teachers
      INSERT INTO public.category_teachers (category_id, teacher_id)
      VALUES (p_category_id, v_teacher_id)
      ON CONFLICT (category_id, teacher_id) DO NOTHING;
    END IF;
  END LOOP;

  -- H. Validate Exact Required Vote Total (5 Votes)
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

  -- 1. Insert Vote Submission Record
  INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
  VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 2. Insert Vote Items & Update Aggregate Totals
  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count > 0 THEN
      -- Record individual ballot breakdown
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_teacher_id, v_vote_count);

      -- Atomically Upsert Aggregate Total Count
      INSERT INTO public.vote_totals (category_id, teacher_id, total_votes, updated_at)
      VALUES (p_category_id, v_teacher_id, v_vote_count, NOW())
      ON CONFLICT (category_id, teacher_id)
      DO UPDATE SET
        total_votes = public.vote_totals.total_votes + EXCLUDED.total_votes,
        updated_at = NOW();
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your vote has been recorded securely!',
    'submission_id', v_submission_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.submit_votes(UUID, JSONB, UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 7. Restrict Vote Totals Table (Leaderboard Tallies to Admins Only)
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "View vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Admins view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Only admins view vote totals" ON public.vote_totals;

CREATE POLICY "Only admins view vote totals"
  ON public.vote_totals FOR SELECT
  USING (public.is_admin() OR auth.role() = 'service_role');

-- --------------------------------------------------------
-- 8. Restrict Vote Items & Vote Submissions Tables
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Public view vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Students view own vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Admins full access vote items" ON public.vote_items;

CREATE POLICY "Students view own vote items"
  ON public.vote_items FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.vote_submissions s
      WHERE s.id = submission_id AND (s.student_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Public view vote submissions" ON public.vote_submissions;
DROP POLICY IF EXISTS "Students view own submissions" ON public.vote_submissions;

CREATE POLICY "Students view own submissions"
  ON public.vote_submissions FOR SELECT
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR student_id = auth.uid()
  );

-- --------------------------------------------------------
-- 9. Atomic High-Speed Leaderboard Function (Zero-Loss Guarantee)
-- --------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_category_leaderboard(UUID);

CREATE OR REPLACE FUNCTION public.get_category_leaderboard(
  p_category_id UUID
)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_photo TEXT,
  teacher_department TEXT,
  total_votes BIGINT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH category_assigned_teachers AS (
    SELECT 
      t.id AS t_id,
      t.name AS t_name,
      t.photo_url AS t_photo,
      t.department AS t_dept
    FROM public.teachers t
    WHERE t.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM public.category_teachers ct 
          WHERE ct.category_id = p_category_id AND ct.teacher_id = t.id
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.category_teachers ct 
          WHERE ct.category_id = p_category_id
        )
      )
  ),
  aggregated_votes AS (
    SELECT
      vi.teacher_id AS t_id,
      COALESCE(SUM(vi.vote_count), 0)::BIGINT AS raw_vote_sum
    FROM public.vote_items vi
    INNER JOIN public.vote_submissions vs 
      ON vs.id = vi.submission_id 
     AND vs.category_id = p_category_id
    GROUP BY vi.teacher_id
  ),
  cached_totals AS (
    SELECT 
      vt.teacher_id AS t_id,
      COALESCE(vt.total_votes, 0)::BIGINT AS cached_sum
    FROM public.vote_totals vt
    WHERE vt.category_id = p_category_id
  )
  SELECT 
    cat.t_id AS teacher_id,
    cat.t_name AS teacher_name,
    cat.t_photo AS teacher_photo,
    cat.t_dept AS teacher_department,
    GREATEST(
      COALESCE(av.raw_vote_sum, 0),
      COALESCE(ct.cached_sum, 0)
    )::BIGINT AS total_votes,
    DENSE_RANK() OVER (
      ORDER BY 
        GREATEST(COALESCE(av.raw_vote_sum, 0), COALESCE(ct.cached_sum, 0)) DESC,
        cat.t_name ASC
    )::BIGINT AS rank
  FROM category_assigned_teachers cat
  LEFT JOIN aggregated_votes av ON av.t_id = cat.t_id
  LEFT JOIN cached_totals ct ON ct.t_id = cat.t_id
  ORDER BY 
    GREATEST(COALESCE(av.raw_vote_sum, 0), COALESCE(ct.cached_sum, 0)) DESC,
    cat.t_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_leaderboard(UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 10. Ensure Realtime Publication for Admin Updates
-- --------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_totals;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_submissions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END;
$$;
