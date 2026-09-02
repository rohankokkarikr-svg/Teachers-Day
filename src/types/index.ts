// ===== User & Auth Types =====
export type UserRole = 'student' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  device_id?: string;
  created_at: string;
  updated_at: string;
}

// ===== Teacher Types =====
export interface Teacher {
  id: string;
  name: string;
  department: string;
  subject?: string;
  photo_url?: string;
  tagline?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== Category Types =====
export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryTeacher {
  id: string;
  category_id: string;
  teacher_id: string;
  teacher?: Teacher;
  category?: Category;
}

// ===== Voting Types =====
export interface VoteSubmission {
  id: string;
  student_id: string;
  category_id: string;
  device_id?: string;
  submitted_at: string;
}

export interface VoteItem {
  id: string;
  submission_id: string;
  teacher_id: string;
  vote_count: number;
  teacher?: Teacher;
}

export interface VoteAllocation {
  teacher_id: string;
  vote_count: number;
}

export interface VoteTotal {
  id: string;
  category_id: string;
  teacher_id: string;
  total_votes: number;
  teacher?: Teacher;
}

// ===== Appreciation Types =====
export type MessageStatus = 'pending' | 'approved' | 'rejected' | 'featured';

export interface AppreciationMessage {
  id: string;
  student_id: string;
  teacher_id?: string;
  category_id?: string;
  message: string;
  status: MessageStatus;
  created_at: string;
  updated_at: string;
  teacher?: Teacher;
}

// ===== Settings Types =====
export interface VotingSettings {
  id: string;
  is_voting_open: boolean;
  show_live_counts: boolean;
  results_finalized: boolean;
  scheduled_start?: string;
  scheduled_end?: string;
  votes_per_category: number;
  updated_at: string;
}

// ===== Admin Types =====
export interface AdminAction {
  id: string;
  admin_id: string;
  action: string;
  details?: Record<string, unknown>;
  created_at: string;
  admin?: Profile;
}

// ===== UI Types =====
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface LeaderboardEntry {
  teacher_id: string;
  teacher_name: string;
  teacher_photo?: string;
  teacher_department: string;
  total_votes: number;
  rank: number;
  previous_rank?: number;
}

// ===== Event Mode Types =====
export type RevealStage = 'idle' | 'category-intro' | 'third-place' | 'second-place' | 'winner' | 'celebration';

export interface EventModeState {
  current_category_id?: string;
  reveal_stage: RevealStage;
  is_active: boolean;
}

// ===== API Response Types =====
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface SubmitVotesPayload {
  category_id: string;
  votes: VoteAllocation[];
}

export interface SubmitVotesResponse {
  success: boolean;
  message: string;
  submission_id?: string;
}
