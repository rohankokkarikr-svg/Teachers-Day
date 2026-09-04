import type { Category } from '../types';
import { getLocalStorage } from '../lib/utils';

export const INITIAL_CATEGORIES_DATA: Category[] = [
  {
    id: '11111111-0000-0000-0000-000000000001',
    name: 'Most Inspiring Teacher',
    description: 'The teacher who lights the spark of curiosity and encourages students',
    icon: '✨',
    display_order: 1,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    name: 'Best Explainer',
    description: 'Makes even the most complex algorithms, formulas, and theories crystal clear',
    icon: '💡',
    display_order: 2,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: '11111111-0000-0000-0000-000000000003',
    name: 'Most Supportive Teacher',
    description: 'Always available during office hours and goes out of their way to help',
    icon: '🤝',
    display_order: 3,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: '11111111-0000-0000-0000-000000000004',
    name: 'Best Motivator',
    description: 'Pushes you to achieve your absolute best and never lets you give up',
    icon: '🔥',
    display_order: 4,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: '11111111-0000-0000-0000-000000000005',
    name: 'Friendliest Teacher',
    description: 'Creates a warm, welcoming, and open environment in every lecture',
    icon: '😊',
    display_order: 5,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: '11111111-0000-0000-0000-000000000006',
    name: 'Most Energetic Teacher',
    description: 'Brings unmatched passion, enthusiasm, and energy to every single class',
    icon: '⚡',
    display_order: 6,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: '11111111-0000-0000-0000-000000000007',
    name: "Students' Favourite Teacher",
    description: 'The overall most beloved mentor of the college community',
    icon: '❤️',
    display_order: 7,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0',
    name: 'Best Non - Technical  Staff',
    description: 'Recognizing outstanding dedication, assistance, and support from non-technical staff',
    icon: '🏆',
    display_order: 8,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
];

export const TEACHING_FACULTY_IDS: string[] = [
  '69880310-6cd0-40d5-80c3-fc257affc81d', // Prof Aishwarya Desai.
  '8381a885-2537-462a-8211-0d1443ab4f68', // Prof Akshata Pethe.
  '2dcff07e-39d7-4d6a-a72c-4d9b784e10d2', // Prof Akshata Vantagodi.
  '2af866ab-bb11-4e75-99d2-309aadffba05', // Prof Akshay Hiremath.
  '365d3ed5-f3c7-47be-b3d9-970b346c2ab2', // Prof Anand Bilagi.
  '81beb89b-d752-45ac-9d2c-c44284112679', // Prof Anup Kalyanshetti.
  '74cbeffa-e7c2-46b3-9289-4b5f621639e4', // Prof Anusha Hiremath.
  '74a7b656-31a2-4c7a-951a-29405707d463', // Prof Krutika Lakkannavar.
  '12391ff0-39c5-4943-85ba-50078dde7633', // Prof Malikjan Bagwan.
  '3b7fe6f2-b16e-44ab-b3cc-89f019268d40', // Prof Pramod Kugatoli.
  '61ff6e22-fd00-4ce7-808e-ef632b32b4f2', // Prof Prashant Kivati.
  '8dd524fc-cf31-4fec-90ac-9843113d8ff5', // Prof Shanta Bhujjanavar.
  '1950874b-1d30-4420-82b3-90649061a0f1', // Prof Shilpa Hosamani.
  '633af82e-ca0d-4785-ba7b-08909cc92ce1', // Prof Suprita Walvekar.
  '87d77938-d6bb-4197-b1b4-5e12f485e17a', // Prof Vinod Jain.
];

export const NON_TECHNICAL_STAFF_IDS: string[] = [
  'f0e5af11-e1de-4a6f-975e-7c0e193693c0', // Mr Ravi Bennole.
  'b2c9cbda-5158-4e64-8b85-9b245625f864', // Mis Mamata Mattikalli.
  'bed87c04-9a5a-46ef-bb0b-4fba71238538', // Mr Mahantesh Manaji.
  '3208c751-30bd-4898-8f17-e22d7fa2e3d5', // Mr Sidrayi Nayak.
];

export const INITIAL_CATEGORY_ASSIGNMENTS: Record<string, string[]> = {
  '11111111-0000-0000-0000-000000000001': [...TEACHING_FACULTY_IDS],
  '11111111-0000-0000-0000-000000000002': [...TEACHING_FACULTY_IDS],
  '11111111-0000-0000-0000-000000000003': [...TEACHING_FACULTY_IDS],
  '11111111-0000-0000-0000-000000000004': [...TEACHING_FACULTY_IDS],
  '11111111-0000-0000-0000-000000000005': [...TEACHING_FACULTY_IDS],
  '11111111-0000-0000-0000-000000000006': [...TEACHING_FACULTY_IDS],
  '11111111-0000-0000-0000-000000000007': [...TEACHING_FACULTY_IDS],
  '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0': [...NON_TECHNICAL_STAFF_IDS],
};

/**
 * Returns default nominee IDs for any category based on whether it is Non-Technical or Faculty
 */
export function getDefaultCategoryTeachers(category?: { id?: string; name?: string; description?: string } | null): string[] {
  if (!category) return [...TEACHING_FACULTY_IDS];
  const name = (category.name || '').toLowerCase();
  const desc = (category.description || '').toLowerCase();
  const id = category.id || '';

  if (
    id === '0bb4bcc1-fdfb-4c8b-bfcf-6ecb453535b0' ||
    name.includes('non-technical') ||
    name.includes('non - technical') ||
    name.includes('staff') ||
    desc.includes('non-technical')
  ) {
    return [...NON_TECHNICAL_STAFF_IDS];
  }

  return [...TEACHING_FACULTY_IDS];
}

/**
 * Robustly reads category assignments, ensuring no category is ever empty unless explicitly configured
 */
export function getCategoryTeacherAssignments(): Record<string, string[]> {
  const stored = getLocalStorage<Record<string, string[]>>(
    'td_category_teacher_assignments',
    INITIAL_CATEGORY_ASSIGNMENTS
  );

  const assignments: Record<string, string[]> = { ...INITIAL_CATEGORY_ASSIGNMENTS, ...stored };

  // Ensure default categories always have non-empty candidate list
  INITIAL_CATEGORIES_DATA.forEach((cat) => {
    if (!assignments[cat.id] || assignments[cat.id].length === 0) {
      assignments[cat.id] = getDefaultCategoryTeachers(cat);
    }
  });

  return assignments;
}
