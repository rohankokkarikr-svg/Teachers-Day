export const APP_NAME = "Teachers' Day Awards";
export const APP_YEAR = 2026;
export const APP_TAGLINE = 'Celebrating the mentors who shape our future';
export const VOTES_PER_CATEGORY = 5;

export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',

  // Student
  VOTE: '/vote',
  CATEGORY_VOTE: '/vote/:categoryId',
  VOTE_REVIEW: '/vote/:categoryId/review',
  LIVE_RESULTS: '/results',
  APPRECIATION: '/appreciation',
  PROFILE: '/profile',

  // Admin
  ADMIN: '/admin',
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_TEACHERS: '/admin/teachers',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_VOTING: '/admin/voting',
  ADMIN_LIVE_RESULTS: '/admin/results',
  ADMIN_PARTICIPATION: '/admin/participation',
  ADMIN_APPRECIATION: '/admin/appreciation',
  ADMIN_FINAL_RESULTS: '/admin/final-results',
  ADMIN_EVENT_MODE: '/admin/event-mode',
  ADMIN_SETTINGS: '/admin/settings',

  // Event Mode
  EVENT_MODE: '/event',
} as const;

export const NAV_ITEMS = {
  student: [
    { label: 'Home', path: ROUTES.HOME, icon: 'Home' },
    { label: 'Vote', path: ROUTES.VOTE, icon: 'Vote' },
    { label: 'Wall', path: ROUTES.APPRECIATION, icon: 'Heart' },
    { label: 'Profile', path: ROUTES.PROFILE, icon: 'User' },
  ],
  admin: [
    { label: 'Dashboard', path: ROUTES.ADMIN_DASHBOARD, icon: 'LayoutDashboard' },
    { label: 'Users & Sessions', path: ROUTES.ADMIN_USERS, icon: 'UserCheck' },
    { label: 'Teachers', path: ROUTES.ADMIN_TEACHERS, icon: 'GraduationCap' },
    { label: 'Categories', path: ROUTES.ADMIN_CATEGORIES, icon: 'FolderOpen' },
    { label: 'Voting', path: ROUTES.ADMIN_VOTING, icon: 'Vote' },
    { label: 'Live Results', path: ROUTES.ADMIN_LIVE_RESULTS, icon: 'BarChart3' },
    { label: 'Participation', path: ROUTES.ADMIN_PARTICIPATION, icon: 'Users' },
    { label: 'Appreciation', path: ROUTES.ADMIN_APPRECIATION, icon: 'MessageSquareHeart' },
    { label: 'Results', path: ROUTES.ADMIN_FINAL_RESULTS, icon: 'Trophy' },
    { label: 'Event Mode', path: ROUTES.ADMIN_EVENT_MODE, icon: 'Presentation' },
    { label: 'Settings', path: ROUTES.ADMIN_SETTINGS, icon: 'Settings' },
  ],
} as const;

export const CATEGORY_ICONS: Record<string, string> = {
  'Most Inspiring Teacher': '✨',
  'Best Explainer': '💡',
  'Most Supportive Teacher': '🤝',
  'Best Motivator': '🔥',
  'Friendliest Teacher': '😊',
  'Most Energetic Teacher': '⚡',
  "Students' Favourite Teacher": '❤️',
};

export const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'] as const;

export const ERROR_MESSAGES = {
  VOTING_CLOSED: 'Voting is currently closed.',
  ALREADY_VOTED: 'You have already voted in this category.',
  INVALID_VOTES: 'Please allocate exactly 5 votes.',
  SUBMISSION_FAILED: 'Something went wrong while submitting your vote. Please try again.',
  CONNECTION_ERROR: 'Your connection was interrupted. Please check your internet connection.',
  UNAUTHORIZED: 'You do not have permission to perform this action.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
} as const;

export const SUCCESS_MESSAGES = {
  VOTE_SUBMITTED: 'Your vote has been submitted successfully!',
  MESSAGE_SUBMITTED: 'Your message has been submitted for review.',
  VOTING_OPENED: 'Voting is now open!',
  VOTING_CLOSED: 'Voting has been closed.',
  RESULTS_FINALIZED: 'Results have been finalized.',
  TEACHER_SAVED: 'Teacher saved successfully.',
  CATEGORY_SAVED: 'Category saved successfully.',
} as const;
