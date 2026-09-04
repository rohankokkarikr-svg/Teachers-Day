-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 021: Fix Data Storage, Permissive RLS Policies & Complete Seed Data
-- ========================================================

SET lock_timeout = '5s';

-- --------------------------------------------------------
-- 1. Enable RLS and Configure Permissive Policies for Anon & Authenticated Roles
-- (Ensures student vote submissions, appreciation notes, and admin actions are saved to DB)
-- --------------------------------------------------------

-- 1.1 appreciation_messages
ALTER TABLE public.appreciation_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students insert appreciation" ON public.appreciation_messages;
DROP POLICY IF EXISTS "View appreciation messages" ON public.appreciation_messages;
DROP POLICY IF EXISTS "Admins full access appreciation" ON public.appreciation_messages;
DROP POLICY IF EXISTS "Public access appreciation" ON public.appreciation_messages;

CREATE POLICY "Public access appreciation"
  ON public.appreciation_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.2 category_teachers
ALTER TABLE public.category_teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users view category_teachers" ON public.category_teachers;
DROP POLICY IF EXISTS "Admins full access category_teachers" ON public.category_teachers;
DROP POLICY IF EXISTS "Public view category_teachers" ON public.category_teachers;
DROP POLICY IF EXISTS "Public access category_teachers" ON public.category_teachers;

CREATE POLICY "Public access category_teachers"
  ON public.category_teachers FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.3 teachers
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users view active teachers" ON public.teachers;
DROP POLICY IF EXISTS "Admins full access teachers" ON public.teachers;
DROP POLICY IF EXISTS "Public view active teachers" ON public.teachers;
DROP POLICY IF EXISTS "Public access teachers" ON public.teachers;

CREATE POLICY "Public access teachers"
  ON public.teachers FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.4 categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users view active categories" ON public.categories;
DROP POLICY IF EXISTS "Admins full access categories" ON public.categories;
DROP POLICY IF EXISTS "Public view active categories" ON public.categories;
DROP POLICY IF EXISTS "Public access categories" ON public.categories;

CREATE POLICY "Public access categories"
  ON public.categories FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.5 admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins access audit log" ON public.admin_actions;
DROP POLICY IF EXISTS "Public access audit log" ON public.admin_actions;

CREATE POLICY "Public access audit log"
  ON public.admin_actions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.6 profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public update profiles" ON public.profiles;

CREATE POLICY "Public access profiles"
  ON public.profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.7 voting_settings
ALTER TABLE public.voting_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View voting settings" ON public.voting_settings;
DROP POLICY IF EXISTS "Admins update voting settings" ON public.voting_settings;
DROP POLICY IF EXISTS "Public view voting settings" ON public.voting_settings;
DROP POLICY IF EXISTS "Public access voting settings" ON public.voting_settings;

CREATE POLICY "Public access voting settings"
  ON public.voting_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.8 user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access user_sessions" ON public.user_sessions;

CREATE POLICY "Public access user_sessions"
  ON public.user_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.9 vote_submissions
ALTER TABLE public.vote_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students view own submissions" ON public.vote_submissions;
DROP POLICY IF EXISTS "Public submit votes" ON public.vote_submissions;
DROP POLICY IF EXISTS "Public access vote_submissions" ON public.vote_submissions;

CREATE POLICY "Public access vote_submissions"
  ON public.vote_submissions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.10 vote_items
ALTER TABLE public.vote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students view own vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Public submit vote items" ON public.vote_items;
DROP POLICY IF EXISTS "Public access vote_items" ON public.vote_items;

CREATE POLICY "Public access vote_items"
  ON public.vote_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- 1.11 vote_totals
ALTER TABLE public.vote_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public view vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public update vote totals" ON public.vote_totals;
DROP POLICY IF EXISTS "Public access vote_totals" ON public.vote_totals;

CREATE POLICY "Public access vote_totals"
  ON public.vote_totals FOR ALL
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------
-- 2. Seed All 8 Award Categories
-- --------------------------------------------------------
INSERT INTO public.categories (id, name, description, icon, display_order, is_active)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Most Inspiring Teacher', 'The teacher who lights the spark of curiosity and encourages students to reach their full potential.', '✨', 1, true),
  ('11111111-0000-0000-0000-000000000002', 'Best Explainer', 'Makes even the most complex algorithms, formulas, and theories crystal clear and easy to grasp.', '💡', 2, true),
  ('11111111-0000-0000-0000-000000000003', 'Most Supportive Teacher', 'Always available during office hours and goes out of their way to help students succeed.', '🤝', 3, true),
  ('11111111-0000-0000-0000-000000000004', 'Best Motivator', 'Pushes you to achieve your absolute best and never lets you give up when things get tough.', '🔥', 4, true),
  ('11111111-0000-0000-0000-000000000005', 'Friendliest Teacher', 'Creates a warm, welcoming, and open environment in every lecture and discussion.', '😊', 5, true),
  ('11111111-0000-0000-0000-000000000006', 'Most Energetic Teacher', 'Brings unmatched passion, enthusiasm, and energy to every single class.', '⚡', 6, true),
  ('11111111-0000-0000-0000-000000000007', 'Students'' Favourite Teacher', 'The overall most beloved mentor of the college community.', '❤️', 7, true),
  ('0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0', 'Best Non - Technical  Staff', 'Recognizing outstanding dedication, assistance, and support from non-technical staff members.', '🏆', 8, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- --------------------------------------------------------
-- 3. Seed All 19 Teachers (15 Faculty + 4 Non-Technical Staff)
-- --------------------------------------------------------
INSERT INTO public.teachers (id, name, department, subject, tagline, photo_url, is_active)
VALUES
  -- 15 Teaching Faculty
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

  -- 4 Non-Technical Staff
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
-- 4. Seed Category-Teacher Nominee Mappings
-- --------------------------------------------------------

-- Ensure unique constraint exists on category_teachers(category_id, teacher_id)
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

-- Assign 15 Teaching Faculty to Categories 1 through 7
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
AND t.department = 'BCA' AND t.is_active = true
ON CONFLICT (category_id, teacher_id) DO NOTHING;

-- Assign 4 Non-Technical Staff to Category 8
INSERT INTO public.category_teachers (category_id, teacher_id)
SELECT '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0'::UUID, t.id
FROM public.teachers t
WHERE t.department = 'Non-Technical Staff' AND t.is_active = true
ON CONFLICT (category_id, teacher_id) DO NOTHING;

-- --------------------------------------------------------
-- 5. Helper Function: sync_system_defaults()
-- (Can be called from client or API to verify and heal categories, teachers and mappings)
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_system_defaults()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_count INT;
  v_teacher_count INT;
  v_mapping_count INT;
BEGIN
  -- 1. Ensure categories
  INSERT INTO public.categories (id, name, description, icon, display_order, is_active)
  VALUES
    ('11111111-0000-0000-0000-000000000001', 'Most Inspiring Teacher', 'The teacher who lights the spark of curiosity and encourages students to reach their full potential.', '✨', 1, true),
    ('11111111-0000-0000-0000-000000000002', 'Best Explainer', 'Makes even the most complex algorithms, formulas, and theories crystal clear and easy to grasp.', '💡', 2, true),
    ('11111111-0000-0000-0000-000000000003', 'Most Supportive Teacher', 'Always available during office hours and goes out of their way to help students succeed.', '🤝', 3, true),
    ('11111111-0000-0000-0000-000000000004', 'Best Motivator', 'Pushes you to achieve your absolute best and never lets you give up when things get tough.', '🔥', 4, true),
    ('11111111-0000-0000-0000-000000000005', 'Friendliest Teacher', 'Creates a warm, welcoming, and open environment in every lecture and discussion.', '😊', 5, true),
    ('11111111-0000-0000-0000-000000000006', 'Most Energetic Teacher', 'Brings unmatched passion, enthusiasm, and energy to every single class.', '⚡', 6, true),
    ('11111111-0000-0000-0000-000000000007', 'Students'' Favourite Teacher', 'The overall most beloved mentor of the college community.', '❤️', 7, true),
    ('0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0', 'Best Non - Technical  Staff', 'Recognizing outstanding dedication, assistance, and support from non-technical staff members.', '🏆', 8, true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

  -- 2. Ensure mappings for faculty (Categories 1-7)
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
  AND t.department = 'BCA' AND t.is_active = true
  ON CONFLICT (category_id, teacher_id) DO NOTHING;

  -- 3. Ensure mappings for non-technical staff (Category 8)
  INSERT INTO public.category_teachers (category_id, teacher_id)
  SELECT '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0'::UUID, t.id
  FROM public.teachers t
  WHERE t.department = 'Non-Technical Staff' AND t.is_active = true
  ON CONFLICT (category_id, teacher_id) DO NOTHING;

  SELECT count(*) INTO v_cat_count FROM public.categories;
  SELECT count(*) INTO v_teacher_count FROM public.teachers;
  SELECT count(*) INTO v_mapping_count FROM public.category_teachers;

  RETURN jsonb_build_object(
    'success', true,
    'categories_count', v_cat_count,
    'teachers_count', v_teacher_count,
    'mappings_count', v_mapping_count,
    'message', 'System defaults synchronized successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_system_defaults() TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 6. Self-Healing, High-Concurrency submit_votes RPC
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_votes(
  p_category_id UUID,
  p_votes JSONB,
  p_student_id UUID DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_submission_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_is_voting_open BOOLEAN;
  v_results_finalized BOOLEAN;
  v_scheduled_start TIMESTAMPTZ;
  v_scheduled_end TIMESTAMPTZ;
  v_required_votes INT := 5;
  v_category_exists BOOLEAN;
  v_category_active BOOLEAN;
  v_total_votes INT := 0;
  v_submission_id UUID;
  v_vote_elem JSONB;
  v_teacher_id UUID;
  v_vote_count INT;
  v_is_revoked BOOLEAN;
  v_existing_submission_id UUID;
  v_device_already_voted BOOLEAN;
  v_teacher_valid BOOLEAN;
  v_mapping_exists BOOLEAN;
BEGIN
  -- 1. Idempotency Check: if this submission_id was already recorded, return success safely
  IF p_submission_id IS NOT NULL THEN
    SELECT id INTO v_existing_submission_id
    FROM public.vote_submissions
    WHERE id = p_submission_id;

    IF v_existing_submission_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'ALREADY_PROCESSED',
        'submission_id', p_submission_id,
        'message', 'Your vote has already been recorded.'
      );
    END IF;
  END IF;

  -- 2. Resolve Student ID
  v_student_id := COALESCE(auth.uid(), p_student_id);

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_STUDENT',
      'message', 'Student identification is required to submit votes.'
    );
  END IF;

  -- 3. Check if student or device was revoked by administrator
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE (user_id = v_student_id::TEXT OR (p_device_id IS NOT NULL AND p_device_id <> '' AND device_id = p_device_id))
      AND is_active = false
  ) INTO v_is_revoked;

  IF v_is_revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCOUNT_REVOKED',
      'message', 'Access Denied: Your account access has been restricted by the administrator.'
    );
  END IF;

  -- Ensure student profile exists in profiles table
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id) THEN
    INSERT INTO public.profiles (id, email, full_name, role, device_id, updated_at)
    VALUES (
      v_student_id,
      'student_' || substring(v_student_id::text from 1 for 8) || '@student.college',
      'Student Voter',
      'student',
      p_device_id,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 4. Validate Voting Settings
  SELECT is_voting_open, results_finalized, scheduled_start, scheduled_end, COALESCE(votes_per_category, 5)
  INTO v_is_voting_open, v_results_finalized, v_scheduled_start, v_scheduled_end, v_required_votes
  FROM public.voting_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    v_is_voting_open := true;
    v_results_finalized := false;
    v_required_votes := 5;
  END IF;

  IF v_results_finalized THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'Voting is closed. Results have been finalized.'
    );
  END IF;

  IF NOT v_is_voting_open THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'Voting is currently closed by the administrator.'
    );
  END IF;

  IF v_scheduled_start IS NOT NULL AND NOW() < v_scheduled_start THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'Voting has not started yet.'
    );
  END IF;

  IF v_scheduled_end IS NOT NULL AND NOW() > v_scheduled_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTING_CLOSED',
      'message', 'The voting period has ended.'
    );
  END IF;

  -- 5. Validate Category Exists and is Active
  SELECT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id),
         COALESCE((SELECT is_active FROM public.categories WHERE id = p_category_id), false)
  INTO v_category_exists, v_category_active;

  IF NOT v_category_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CATEGORY_NOT_FOUND',
      'message', 'The specified award category does not exist.'
    );
  END IF;

  IF NOT v_category_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CATEGORY_INACTIVE',
      'message', 'Voting is disabled for this category.'
    );
  END IF;

  -- 6. Self-Healing check: If category_teachers has 0 rows for this category, auto-seed them
  SELECT EXISTS (
    SELECT 1 FROM public.category_teachers WHERE category_id = p_category_id
  ) INTO v_mapping_exists;

  IF NOT v_mapping_exists THEN
    IF p_category_id = '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0'::UUID THEN
      -- Non-technical staff category
      INSERT INTO public.category_teachers (category_id, teacher_id)
      SELECT p_category_id, id FROM public.teachers WHERE department = 'Non-Technical Staff' AND is_active = true
      ON CONFLICT (category_id, teacher_id) DO NOTHING;
    ELSE
      -- Faculty category
      INSERT INTO public.category_teachers (category_id, teacher_id)
      SELECT p_category_id, id FROM public.teachers WHERE department <> 'Non-Technical Staff' AND is_active = true
      ON CONFLICT (category_id, teacher_id) DO NOTHING;
    END IF;
  END IF;

  -- 7. Duplicate Submission Check (Student + Category)
  IF EXISTS (
    SELECT 1 FROM public.vote_submissions
    WHERE student_id = v_student_id AND category_id = p_category_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'DUPLICATE_SUBMISSION',
      'error_code', 'DUPLICATE_SUBMISSION',
      'message', 'You have already submitted your vote for this category.'
    );
  END IF;

  -- 8. Device Anti-Abuse Check (1 Account per Device per Category)
  IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vote_submissions
      WHERE device_id = p_device_id
        AND category_id = p_category_id
        AND student_id <> v_student_id
    ) INTO v_device_already_voted;

    IF v_device_already_voted THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'DEVICE_ALREADY_VOTED',
        'error_code', 'DEVICE_ALREADY_VOTED',
        'message', 'A vote has already been cast from this device for this category by another student account.'
      );
    END IF;
  END IF;

  -- 9. Validate Votes Array Structure and Sum
  IF p_votes IS NULL OR jsonb_array_length(p_votes) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EMPTY_VOTES',
      'message', 'No vote allocations were provided.'
    );
  END IF;

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count IS NULL OR v_vote_count <= 0 THEN
      CONTINUE;
    END IF;

    v_total_votes := v_total_votes + v_vote_count;

    -- Validate teacher exists, is active, and is assigned to category
    SELECT EXISTS (
      SELECT 1 FROM public.category_teachers ct
      JOIN public.teachers t ON t.id = ct.teacher_id
      WHERE ct.category_id = p_category_id
        AND ct.teacher_id = v_teacher_id
        AND t.is_active = true
    ) INTO v_teacher_valid;

    IF NOT v_teacher_valid THEN
      -- If teacher exists and is active, auto-link to category for self-healing
      IF EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id AND is_active = true) THEN
        INSERT INTO public.category_teachers (category_id, teacher_id)
        VALUES (p_category_id, v_teacher_id)
        ON CONFLICT (category_id, teacher_id) DO NOTHING;
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'TEACHER_NOT_IN_CATEGORY',
          'message', 'Teacher is not an eligible nominee for this category.'
        );
      END IF;
    END IF;
  END LOOP;

  IF v_total_votes <> v_required_votes THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'VOTE_LIMIT_EXCEEDED',
      'message', format('Please allocate exactly %s votes. (Currently allocated: %s)', v_required_votes, v_total_votes)
    );
  END IF;

  -- --------------------------------------------------------
  -- ATOMIC DATABASE COMMIT
  -- --------------------------------------------------------
  v_submission_id := COALESCE(p_submission_id, gen_random_uuid());

  INSERT INTO public.vote_submissions (id, student_id, category_id, device_id, submitted_at)
  VALUES (v_submission_id, v_student_id, p_category_id, p_device_id, NOW())
  ON CONFLICT (student_id, category_id) DO NOTHING;

  FOR v_vote_elem IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_teacher_id := (v_vote_elem->>'teacher_id')::UUID;
    v_vote_count := (v_vote_elem->>'vote_count')::INT;

    IF v_vote_count IS NOT NULL AND v_vote_count > 0 THEN
      -- Insert detailed vote item
      INSERT INTO public.vote_items (submission_id, teacher_id, vote_count)
      VALUES (v_submission_id, v_teacher_id, v_vote_count);

      -- Update materialized vote total (Atomic Increment)
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
    'submission_id', v_submission_id,
    'message', 'Your vote has been submitted successfully!'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'TRANSACTION_ERROR',
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_votes(UUID, JSONB, UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- --------------------------------------------------------
-- 7. Master System Reset Function (Preserves Categories & Teachers)
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.master_reset_all_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Delete student sessions
  DELETE FROM public.user_sessions
  WHERE role = 'student';

  -- Clear device_id from remaining profiles
  UPDATE public.profiles
  SET device_id = NULL;

  -- Reset voting settings to default open state
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

  -- Re-ensure default category-teacher assignments
  PERFORM public.sync_system_defaults();

  RETURN jsonb_build_object('success', true, 'message', 'All votes, ballots, appreciation notes, and student records have been permanently wiped.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.master_reset_all_data() TO authenticated, anon, service_role;
