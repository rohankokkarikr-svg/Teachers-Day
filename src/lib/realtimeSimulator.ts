/**
 * Real-Time Voting & Activity Feed Tracker
 * Records genuine student voting events
 */

import { getLocalStorage, setLocalStorage } from './utils';

export interface LiveVoteActivity {
  id: string;
  student_name: string;
  category_id: string;
  category_name: string;
  teacher_id: string;
  teacher_name: string;
  votes_added: number;
  timestamp: string;
}

/**
 * Returns actual recent real-time voting activity (starts completely empty)
 */
export function getRecentVoteActivity(): LiveVoteActivity[] {
  return getLocalStorage<LiveVoteActivity[]>('td_recent_vote_activity', []);
}

/**
 * Records a genuine student voting activity event into the feed
 */
export function addVoteActivity(activity: Omit<LiveVoteActivity, 'id' | 'timestamp'>): void {
  try {
    const list = getRecentVoteActivity();
    const newItem: LiveVoteActivity = {
      ...activity,
      id: 'act-' + Date.now(),
      timestamp: new Date().toISOString(),
    };
    const updated = [newItem, ...list.slice(0, 19)];
    setLocalStorage('td_recent_vote_activity', updated);
    window.dispatchEvent(new Event('td_live_activity_updated'));
  } catch {
    // Ignore storage errors
  }
}
