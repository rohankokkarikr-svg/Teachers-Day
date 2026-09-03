-- ========================================================
-- TEACHERS' DAY LIVE VOTING & AWARDS PLATFORM 2026
-- Migration 008: Populate Minimum 50+ Candidate Teachers & Category Links
-- ========================================================

-- Insert/Upsert 52 Teachers Across Diverse Academic Departments
INSERT INTO public.teachers (id, name, department, subject, tagline, photo_url, is_active)
VALUES
  ('22222222-0000-0000-0000-000000000001', 'Dr. Priya Sharma', 'Computer Science', 'Data Structures & Algorithms', 'Making algorithms intuitive, visual, and fun!', '', true),
  ('22222222-0000-0000-0000-000000000002', 'Prof. Rajesh Kumar', 'Mathematics', 'Linear Algebra & Calculus', 'Numbers tell stories if you listen closely.', '', true),
  ('22222222-0000-0000-0000-000000000003', 'Dr. Ananya Desai', 'Physics', 'Quantum Mechanics & Optics', 'Exploring the deepest mysteries of the universe.', '', true),
  ('22222222-0000-0000-0000-000000000004', 'Prof. Vikram Singh', 'English Literature', 'Modern Communication & Rhetoric', 'Words have the power to change minds and nations.', '', true),
  ('22222222-0000-0000-0000-000000000005', 'Dr. Meera Patel', 'Chemistry', 'Organic Chemistry & Biochemistry', 'Chemistry is the melody of life around us.', '', true),
  ('22222222-0000-0000-0000-000000000006', 'Prof. Arjun Nair', 'Electronics', 'Digital System Design & VLSI', 'Building tomorrow hardware architecture today.', '', true),
  ('22222222-0000-0000-0000-000000000007', 'Dr. Sunita Rao', 'Biotechnology', 'Genetic Engineering & Bioinformatics', 'Unraveling the code of living systems.', '', true),
  ('22222222-0000-0000-0000-000000000008', 'Prof. Kabir Verma', 'Mechanical Eng.', 'Thermodynamics & Heat Transfer', 'Engineering efficiency and power in motion.', '', true),
  ('22222222-0000-0000-0000-000000000009', 'Dr. Arvind Swaminathan', 'Computer Science', 'Machine Learning & Neural Networks', 'Teaching computers how to understand our world.', '', true),
  ('22222222-0000-0000-0000-000000000010', 'Prof. Shalini Menon', 'AI & Data Science', 'Deep Learning & Big Data Analytics', 'Turning raw data into impactful intelligence.', '', true),
  ('22222222-0000-0000-0000-000000000011', 'Dr. Rohan Kulkarni', 'Information Technology', 'Cloud Architecture & DevOps', 'Designing resilient distributed systems at scale.', '', true),
  ('22222222-0000-0000-0000-000000000012', 'Prof. Neha Gupta', 'Computer Science', 'Database Management & SQL Systems', 'Structured knowledge creates lightning-fast solutions.', '', true),
  ('22222222-0000-0000-0000-000000000013', 'Dr. Amitav Ghosh', 'Civil Engineering', 'Structural Mechanics & Earthquake Eng.', 'Laying unshakable foundations for the future.', '', true),
  ('22222222-0000-0000-0000-000000000014', 'Prof. Sneha Sen', 'Civil Engineering', 'Environmental Eng. & Water Resources', 'Sustainable infrastructure for a greener planet.', '', true),
  ('22222222-0000-0000-0000-000000000015', 'Dr. Harish Chandra', 'Mathematics', 'Discrete Mathematics & Graph Theory', 'Every problem has a logical, elegant solution.', '', true),
  ('22222222-0000-0000-0000-000000000016', 'Prof. Deepa Nair', 'Mathematics', 'Probability, Statistics & Stochastic Models', 'Finding certainty in a world of randomness.', '', true),
  ('22222222-0000-0000-0000-000000000017', 'Dr. Manish Tiwari', 'Physics', 'Electromagnetism & Solid State Physics', 'From semiconductors to stars, physics connects all.', '', true),
  ('22222222-0000-0000-0000-000000000018', 'Prof. Pooja Hegde', 'Physics', 'Nuclear Physics & Astrophysics', 'Curiosity is the engine of human discovery.', '', true),
  ('22222222-0000-0000-0000-000000000019', 'Dr. Suresh Balakrishnan', 'Chemistry', 'Inorganic Chemistry & Coordination Polymers', 'Discovering novel crystal lattices and catalysts.', '', true),
  ('22222222-0000-0000-0000-000000000020', 'Prof. Kavita Krishnan', 'Chemistry', 'Physical Chemistry & Spectroscopy', 'Measuring molecular bonds with laser precision.', '', true),
  ('22222222-0000-0000-0000-000000000021', 'Dr. Vivek Reddy', 'Electrical Eng.', 'Power Systems & Smart Grids', 'Energizing communities with renewable power.', '', true),
  ('22222222-0000-0000-0000-000000000022', 'Prof. Aarti Saxena', 'Electrical Eng.', 'Control Systems & Robotics', 'Precision control for autonomous systems.', '', true),
  ('22222222-0000-0000-0000-000000000023', 'Dr. Sanjay Bhattacharya', 'Electronics', 'Microprocessors & Embedded Systems', 'Writing firmware that bridges hardware and software.', '', true),
  ('22222222-0000-0000-0000-000000000024', 'Prof. Divya Pillai', 'Electronics', 'Wireless & Satellite Communication', 'Connecting the furthest corners of our planet.', '', true),
  ('22222222-0000-0000-0000-000000000025', 'Dr. Alok Mathur', 'Mechanical Eng.', 'Fluid Dynamics & Aerodynamics', 'Optimizing flow patterns for peak performance.', '', true),
  ('22222222-0000-0000-0000-000000000026', 'Prof. Ritu Singhania', 'Mechanical Eng.', 'CAD/CAM & Industrial Robotics', 'From digital blueprints to physical masterpieces.', '', true),
  ('22222222-0000-0000-0000-000000000027', 'Dr. Chetan Joshi', 'Computer Science', 'Cybersecurity & Cryptography', 'Defending data privacy with mathematical proof.', '', true),
  ('22222222-0000-0000-0000-000000000028', 'Prof. Nandini Sundaram', 'Computer Science', 'Software Engineering & Agile Systems', 'Writing clean, testable code that stands the test of time.', '', true),
  ('22222222-0000-0000-0000-000000000029', 'Dr. Tarun Sengupta', 'Information Technology', 'Computer Networks & Distributed Ledgers', 'Architecting peer-to-peer decentralized networks.', '', true),
  ('22222222-0000-0000-0000-000000000030', 'Prof. Preeti Agarwal', 'Information Technology', 'Web Technologies & Full-Stack Development', 'Crafting responsive, intuitive user experiences.', '', true),
  ('22222222-0000-0000-0000-000000000031', 'Dr. Manoj Nambiar', 'AI & Data Science', 'Natural Language Processing & LLMs', 'Teaching machines the nuances of human language.', '', true),
  ('22222222-0000-0000-0000-000000000032', 'Prof. Swati Deshmukh', 'AI & Data Science', 'Computer Vision & Pattern Recognition', 'Empowering machines with visual perception.', '', true),
  ('22222222-0000-0000-0000-000000000033', 'Dr. Kiran Mazumdar', 'Biotechnology', 'Immunology & Cellular Biology', 'Understanding immunity to pioneer breakthrough therapies.', '', true),
  ('22222222-0000-0000-0000-000000000034', 'Prof. Ashwin Murthy', 'Biotechnology', 'Microbiology & Fermentation Tech', 'Harnessing microbial power for industrial innovation.', '', true),
  ('22222222-0000-0000-0000-000000000035', 'Dr. Tanvi Rao', 'Business & Management', 'Strategic Leadership & Organizational Behavior', 'Inspiring leaders who build people-first cultures.', '', true),
  ('22222222-0000-0000-0000-000000000036', 'Prof. Pradeep Mukherjee', 'Business & Management', 'Financial Markets & Quantitative Economics', 'Decoding market dynamics with quantitative rigor.', '', true),
  ('22222222-0000-0000-0000-000000000037', 'Dr. Sangeeta Biswas', 'Humanities', 'Ethics, Philosophy & Technology Policy', 'Guiding technological advancement with human values.', '', true),
  ('22222222-0000-0000-0000-000000000038', 'Prof. Nitin Pandey', 'Humanities', 'World History & International Relations', 'Understanding our past illuminates our future.', '', true),
  ('22222222-0000-0000-0000-000000000039', 'Dr. Bhavna Chawla', 'Civil Engineering', 'Geotechnical & Foundation Engineering', 'Analyzing soil dynamics for mega-structures.', '', true),
  ('22222222-0000-0000-0000-000000000040', 'Prof. Gaurav Sethi', 'Civil Engineering', 'Transportation & Urban Transit Planning', 'Designing congestion-free transit for smart cities.', '', true),
  ('22222222-0000-0000-0000-000000000041', 'Dr. Leela Ganguly', 'Electrical Eng.', 'High Voltage Engineering & Protection', 'Safeguarding transmission corridors worldwide.', '', true),
  ('22222222-0000-0000-0000-000000000042', 'Prof. Yashwant Rao', 'Electrical Eng.', 'Electric Vehicles & Battery Tech', 'Driving zero-emission electric mobility solutions.', '', true),
  ('22222222-0000-0000-0000-000000000043', 'Dr. Madhavi Latha', 'Mathematics', 'Numerical Methods & Optimization', 'Finding fastest convergence paths for heavy computation.', '', true),
  ('22222222-0000-0000-0000-000000000044', 'Prof. Siddharth Roy', 'Computer Science', 'Operating Systems & Kernel Design', 'Managing CPU cycles, threads, and memory efficiently.', '', true),
  ('22222222-0000-0000-0000-000000000045', 'Dr. Pallavi Joshi', 'Computer Science', 'Compiler Design & Formal Languages', 'Translating human ideas into machine assembly instructions.', '', true),
  ('22222222-0000-0000-0000-000000000046', 'Prof. Raghavendra Rao', 'Mechanical Eng.', 'Manufacturing Processes & Materials Science', 'Forging ultra-strong alloys for aerospace missions.', '', true),
  ('22222222-0000-0000-0000-000000000047', 'Dr. Geeta Somani', 'Business & Management', 'Marketing Analytics & Consumer Psychology', 'Understanding customer sentiment through data storytelling.', '', true),
  ('22222222-0000-0000-0000-000000000048', 'Prof. Abhimanyu Das', 'English Literature', 'Creative Writing & Dramatic Arts', 'Every student has a profound story waiting to be told.', '', true),
  ('22222222-0000-0000-0000-000000000049', 'Dr. Usha Narayanan', 'Physics', 'Thermodynamics & Statistical Mechanics', 'Connecting microscopic atoms to macroscopic energy.', '', true),
  ('22222222-0000-0000-0000-000000000050', 'Prof. Farhan Qureshi', 'Mechanical Eng.', 'Automotive Engineering & Mechatronics', 'Innovating powertrain dynamics for tomorrow vehicles.', '', true),
  ('22222222-0000-0000-0000-000000000051', 'Dr. Radhika Madan', 'Chemistry', 'Polymer Chemistry & Nanomaterials', 'Synthesizing smart polymers with adaptive capabilities.', '', true),
  ('22222222-0000-0000-0000-000000000052', 'Prof. Omkar Varma', 'Electronics', 'IoT Systems & Sensor Networks', 'Building smart ambient environments that sense and adapt.', '', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  subject = EXCLUDED.subject,
  tagline = EXCLUDED.tagline,
  is_active = EXCLUDED.is_active;

-- Link all teachers to all active categories
INSERT INTO public.category_teachers (category_id, teacher_id)
SELECT c.id, t.id
FROM public.categories c
CROSS JOIN public.teachers t
ON CONFLICT (category_id, teacher_id) DO NOTHING;
