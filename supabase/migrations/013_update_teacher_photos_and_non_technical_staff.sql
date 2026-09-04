-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 013: Upsert 15 Teaching Faculty & 4 Non-Technical Staff with Real Photos
-- ========================================================

-- 1. Ensure all 19 Teachers & Non-Technical Staff are present in public.teachers
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

-- 2. Ensure Category 8 (Best Non - Technical Staff) is present
INSERT INTO public.categories (id, name, description, icon, display_order, is_active)
VALUES
  ('0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0', 'Best Non - Technical  Staff', 'Recognizing outstanding dedication, assistance, and support from non-technical staff', '🏆', 8, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 3. Assign 15 Teaching Faculty to Categories 1 through 7
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

-- 4. Assign 4 Non-Technical Staff to Category 8 (Best Non - Technical Staff)
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
