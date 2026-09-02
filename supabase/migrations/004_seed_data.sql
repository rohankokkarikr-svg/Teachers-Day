-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 004: Development Seed Data
-- ========================================================

-- Insert Sample Categories (Valid Hex UUIDs)
INSERT INTO public.categories (id, name, description, icon, display_order, is_active)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Most Inspiring Teacher', 'The teacher who lights the spark of curiosity and encourages students to reach beyond their limits.', '✨', 1, true),
  ('11111111-0000-0000-0000-000000000002', 'Best Explainer', 'Makes even the most complex algorithms, formulas, and theories crystal clear.', '💡', 2, true),
  ('11111111-0000-0000-0000-000000000003', 'Most Supportive Teacher', 'Always available during office hours and goes out of their way to help every student.', '🤝', 3, true),
  ('11111111-0000-0000-0000-000000000004', 'Best Motivator', 'Pushes you to achieve your absolute best and never lets you give up.', '🔥', 4, true),
  ('11111111-0000-0000-0000-000000000005', 'Friendliest Teacher', 'Creates a warm, welcoming, and open environment in every lecture.', '😊', 5, true),
  ('11111111-0000-0000-0000-000000000006', 'Most Energetic Teacher', 'Brings unmatched passion, enthusiasm, and energy to every single class.', '⚡', 6, true),
  ('11111111-0000-0000-0000-000000000007', 'Students Favourite Teacher', 'The overall most beloved mentor of the college community.', '❤️', 7, true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

-- Insert Sample Teachers (Valid Hex UUIDs)
INSERT INTO public.teachers (id, name, department, subject, tagline, photo_url, is_active)
VALUES
  ('22222222-0000-0000-0000-000000000001', 'Dr. Priya Sharma', 'Computer Science', 'Data Structures & Algorithms', 'Making algorithms intuitive and fun!', '', true),
  ('22222222-0000-0000-0000-000000000002', 'Prof. Rajesh Kumar', 'Mathematics', 'Linear Algebra & Calculus', 'Numbers tell stories if you listen closely.', '', true),
  ('22222222-0000-0000-0000-000000000003', 'Dr. Ananya Desai', 'Physics', 'Quantum Mechanics', 'Exploring the mysteries of the universe.', '', true),
  ('22222222-0000-0000-0000-000000000004', 'Prof. Vikram Singh', 'English Literature', 'Modern Communication', 'Words have the power to change minds.', '', true),
  ('22222222-0000-0000-0000-000000000005', 'Dr. Meera Patel', 'Chemistry', 'Organic Chemistry', 'Chemistry is in everything around us.', '', true),
  ('22222222-0000-0000-0000-000000000006', 'Prof. Arjun Nair', 'Electronics', 'Digital System Design', 'Building tomorrow hardware today.', '', true),
  ('22222222-0000-0000-0000-000000000007', 'Dr. Sunita Rao', 'Biotechnology', 'Genetic Engineering', 'Unraveling the code of life.', '', true),
  ('22222222-0000-0000-0000-000000000008', 'Prof. Kabir Verma', 'Mechanical Eng.', 'Thermodynamics', 'Engineering efficiency in motion.', '', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  subject = EXCLUDED.subject,
  tagline = EXCLUDED.tagline;

-- Assign Teachers to Categories (M:N)
INSERT INTO public.category_teachers (category_id, teacher_id)
SELECT c.id, t.id
FROM public.categories c
CROSS JOIN public.teachers t
ON CONFLICT (category_id, teacher_id) DO NOTHING;
