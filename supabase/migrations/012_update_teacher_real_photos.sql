-- Migration 012: Update Teachers' & Non-Technical Staff Real Profile Photos
-- Associates each teacher and staff record with their uploaded profile photo in /teachers/

-- 1. Teaching Faculty (15 Members)
UPDATE public.teachers SET photo_url = '/teachers/teacher_3.jpeg', name = 'Prof Prashant Kivati.', department = 'BCA' WHERE id = '61ff6e22-fd00-4ce7-808e-ef632b32b4f2' OR name ILIKE '%Prashant Kivati%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_7.jpeg', name = 'Prof Malikjan Bagwan.', department = 'BCA' WHERE id = '12391ff0-39c5-4943-85ba-50078dde7633' OR name ILIKE '%Malikjan Bagwan%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_10.jpeg', name = 'Prof Akshay Hiremath.', department = 'BCA' WHERE id = '2af866ab-bb11-4e75-99d2-309aadffba05' OR name ILIKE '%Akshay Hiremath%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_8.jpeg', name = 'Prof Krutika Lakkannavar.', department = 'BCA' WHERE id = '74a7b656-31a2-4c7a-951a-29405707d463' OR name ILIKE '%Krutika Lakkannavar%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_13.jpeg', name = 'Prof Aishwarya Desai.', department = 'BCA' WHERE id = '69880310-6cd0-40d5-80c3-fc257affc81d' OR name ILIKE '%Aishwarya Desai%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_6.jpeg', name = 'Prof Akshata Pethe.', department = 'BCA' WHERE id = '8381a885-2537-462a-8211-0d1443ab4f68' OR name ILIKE '%Akshata Pethe%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_11.jpeg', name = 'Prof Akshata Vantagodi.', department = 'BCA' WHERE id = '2dcff07e-39d7-4d6a-a72c-4d9b784e10d2' OR name ILIKE '%Akshata Vantagodi%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_9.jpeg', name = 'Prof Anand Bilagi.', department = 'BCA' WHERE id = '365d3ed5-f3c7-47be-b3d9-970b346c2ab2' OR name ILIKE '%Anand Bilagi%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_19.jpeg', name = 'Prof Anup Kalyanshetti.', department = 'BCA' WHERE id = '81beb89b-d752-45ac-9d2c-c44284112679' OR name ILIKE '%Anup Kalyanshetti%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_4.jpeg', name = 'Prof Anusha Hiremath.', department = 'BCA' WHERE id = '74cbeffa-e7c2-46b3-9289-4b5f621639e4' OR name ILIKE '%Anusha Hiremath%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_12.jpeg', name = 'Prof Pramod Kugatoli.', department = 'BCA' WHERE id = '3b7fe6f2-b16e-44ab-b3cc-89f019268d40' OR name ILIKE '%Pramod Kugatoli%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_2.jpeg', name = 'Prof Shanta Bhujjanavar.', department = 'BCA' WHERE id = '8dd524fc-cf31-4fec-90ac-9843113d8ff5' OR name ILIKE '%Shanta Bhujjanavar%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_1.jpeg', name = 'Prof Shilpa Hosamani.', department = 'BCA' WHERE id = '1950874b-1d30-4420-82b3-90649061a0f1' OR name ILIKE '%Shilpa Hosamani%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_5.jpeg', name = 'Prof Suprita Walvekar.', department = 'BCA' WHERE id = '633af82e-ca0d-4785-ba7b-08909cc92ce1' OR name ILIKE '%Suprita Walvekar%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_17.jpeg', name = 'Prof Vinod Jain.', department = 'BCA' WHERE id = '87d77938-d6bb-4197-b1b4-5e12f485e17a' OR name ILIKE '%Vinod Jain%';

-- 2. Non-Technical Staff (4 Members)
UPDATE public.teachers SET photo_url = '/teachers/teacher_18.jpeg', name = 'Mr Ravi Bennole.', department = 'Non-Technical Staff' WHERE id = 'f0e5af11-e1de-4a6f-975e-7c0e193693c0' OR name ILIKE '%Ravi Bennol%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_14.jpeg', name = 'Mr Mahantesh Manaji.', department = 'Non-Technical Staff' WHERE id = 'bed87c04-9a5a-46ef-bb0b-4fba71238538' OR name ILIKE '%Mahantesh Manaji%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_15.jpeg', name = 'Mis Mamata Mattikalli.', department = 'Non-Technical Staff' WHERE id = 'b2c9cbda-5158-4e64-8b85-9b245625f864' OR name ILIKE '%Mamata Mattikalli%';
UPDATE public.teachers SET photo_url = '/teachers/teacher_16.jpeg', name = 'Mr Sidrayi Nayak.', department = 'Non-Technical Staff' WHERE id = '3208c751-30bd-4898-8f17-e22d7fa2e3d5' OR name ILIKE '%Sidrayi Nayak%';
