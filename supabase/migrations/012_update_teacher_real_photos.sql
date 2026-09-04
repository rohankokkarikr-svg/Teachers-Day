-- Migration 012: Update Teachers' Real Profile Photos
-- Associates each teacher record with their uploaded profile photo in /teachers/

UPDATE public.teachers SET photo_url = '/teachers/teacher_1.jpeg' WHERE name ILIKE '%Mamata Mattikalli%' OR id = 'b2c9cbda-5158-4e64-8b85-9b245625f864';
UPDATE public.teachers SET photo_url = '/teachers/teacher_14.jpeg' WHERE name ILIKE '%Mahantesh Manaji%' OR id = 'bed87c04-9a5a-46ef-bb0b-4fba71238538';
UPDATE public.teachers SET photo_url = '/teachers/teacher_12.jpeg' WHERE name ILIKE '%Sidrayi Nayak%' OR id = '3208c751-30bd-4898-8f17-e22d7fa2e3d5';
UPDATE public.teachers SET photo_url = '/teachers/teacher_4.jpeg' WHERE name ILIKE '%Aishwarya Desai%' OR id = '69880310-6cd0-40d5-80c3-fc257affc81d';
UPDATE public.teachers SET photo_url = '/teachers/teacher_5.jpeg' WHERE name ILIKE '%Akshata Pethe%' OR id = '8381a885-2537-462a-8211-0d1443ab4f68';
UPDATE public.teachers SET photo_url = '/teachers/teacher_6.jpeg' WHERE name ILIKE '%Akshata Vantagodi%' OR id = '2dcff07e-39d7-4d6a-a72c-4d9b784e10d2';
UPDATE public.teachers SET photo_url = '/teachers/teacher_17.jpeg' WHERE name ILIKE '%Akshay Hiremath%' OR id = '2af866ab-bb11-4e75-99d2-309aadffba05';
UPDATE public.teachers SET photo_url = '/teachers/teacher_7.jpeg' WHERE name ILIKE '%Anand Bilagi%' OR id = '365d3ed5-f3c7-47be-b3d9-970b346c2ab2';
UPDATE public.teachers SET photo_url = '/teachers/teacher_9.jpeg' WHERE name ILIKE '%Anup Kalyanshetti%' OR id = '81beb89b-d752-45ac-9d2c-c44284112679';
UPDATE public.teachers SET photo_url = '/teachers/teacher_8.jpeg' WHERE name ILIKE '%Anusha Hiremath%' OR id = '74cbeffa-e7c2-46b3-9289-4b5f621639e4';
UPDATE public.teachers SET photo_url = '/teachers/teacher_13.jpeg' WHERE name ILIKE '%Krutika Lakkannavar%' OR id = '74a7b656-31a2-4c7a-951a-29405707d463';
UPDATE public.teachers SET photo_url = '/teachers/teacher_10.jpeg' WHERE name ILIKE '%Malikjan Bagwan%' OR id = '12391ff0-39c5-4943-85ba-50078dde7633';
UPDATE public.teachers SET photo_url = '/teachers/teacher_16.jpeg' WHERE name ILIKE '%Pramod Kugatoli%' OR id = '3b7fe6f2-b16e-44ab-b3cc-89f019268d40';
UPDATE public.teachers SET photo_url = '/teachers/teacher_3.jpeg' WHERE name ILIKE '%Prashant Kivati%' OR id = '61ff6e22-fd00-4ce7-808e-ef632b32b4f2';
UPDATE public.teachers SET photo_url = '/teachers/teacher_18.jpeg' WHERE name ILIKE '%Ravi Bennoli%' OR id = 'f0e5af11-e1de-4a6f-975e-7c0e193693c0';
UPDATE public.teachers SET photo_url = '/teachers/teacher_2.jpeg' WHERE name ILIKE '%Shanta Bhujjanavar%' OR id = '8dd524fc-cf31-4fec-90ac-9843113d8ff5';
UPDATE public.teachers SET photo_url = '/teachers/teacher_11.jpeg' WHERE name ILIKE '%Shilpa Hosamani%' OR id = '1950874b-1d30-4420-82b3-90649061a0f1';
UPDATE public.teachers SET photo_url = '/teachers/teacher_15.jpeg' WHERE name ILIKE '%Suprita Walvekar%' OR id = '633af82e-ca0d-4785-ba7b-08909cc92ce1';
UPDATE public.teachers SET photo_url = '/teachers/teacher_16.jpeg' WHERE name ILIKE '%Vinod Jain%' OR id = '87d77938-d6bb-4197-b1b4-5e12f485e17a';
