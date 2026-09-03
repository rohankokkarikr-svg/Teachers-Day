import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage } from '../lib/utils';
import { getAllTeachers } from './useTeachers';
import { INITIAL_CATEGORY_ASSIGNMENTS } from '../data/initialCategories';
import type { LeaderboardEntry, VotingSettings } from '../types';

/**
 * Generates category leaderboard entries strictly based on actual submitted votes and dynamic admin teachers
 */
export function getCategoryFallbackLeaderboard(categoryId?: string): LeaderboardEntry[] {
  const catId = categoryId || '11111111-0000-0000-0000-000000000001';

  // Read all teachers (including any added/edited by admin)
  const teachers = getAllTeachers().filter((t) => t.is_active !== false);

  // Filter by category assignment if configured
  const assignments = getLocalStorage<Record<string, string[]>>(
    'td_category_teacher_assignments',
    INITIAL_CATEGORY_ASSIGNMENTS
  );
  const catAssigned = assignments[catId];
  const categoryTeachers = catAssigned !== undefined
    ? teachers.filter((t) => new Set(catAssigned).has(t.id))
    : teachers;

  // Read actual submitted votes cast by real students
  const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
  const catLocalVotes = localTotals[catId] || {};

  const entries: LeaderboardEntry[] = categoryTeachers.map((t) => {
    const actualVotes = catLocalVotes[t.id] ?? 0;
    return {
      teacher_id: t.id,
      teacher_name: t.name,
      teacher_photo: t.photo_url || '',
      teacher_department: t.department,
      total_votes: actualVotes,
      rank: 1,
    };
  });

  // Sort descending by total_votes, then alphabetically by teacher name
  entries.sort((a, b) => b.total_votes - a.total_votes || a.teacher_name.localeCompare(b.teacher_name));

  // Assign ranks
  return entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

export function useRealtime(categoryId?: string) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => getCategoryFallbackLeaderboard(categoryId));
  const [showLiveCounts, setShowLiveCounts] = useState<boolean>(() => {
    const s = getLocalStorage<VotingSettings | null>('td_admin_settings', null);
    return s ? s.show_live_counts : true;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch leaderboard for category
  const fetchLeaderboard = useCallback(async () => {
    const s = getLocalStorage<VotingSettings | null>('td_admin_settings', null);
    if (s) setShowLiveCounts(s.show_live_counts);

    if (!categoryId) {
      setLeaderboard(getCategoryFallbackLeaderboard());
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setLeaderboard(getCategoryFallbackLeaderboard(categoryId));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch voting settings (show_live_counts)
      const settingsPromise = supabase
        .from('voting_settings')
        .select('show_live_counts')
        .eq('id', 1)
        .maybeSingle();

      // 2. Fetch category teachers and vote totals directly
      const teachersPromise = supabase
        .from('teachers')
        .select('*')
        .eq('is_active', true);

      const ctPromise = supabase
        .from('category_teachers')
        .select('teacher_id')
        .eq('category_id', categoryId);

      const totalsPromise = supabase
        .from('vote_totals')
        .select('teacher_id, total_votes')
        .eq('category_id', categoryId);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Leaderboard fetch timeout')), 3000)
      );

      const [settingsRes, teachersRes, ctRes, totalsRes] = (await Promise.race([
        Promise.all([settingsPromise, teachersPromise, ctPromise, totalsPromise]),
        timeoutPromise,
      ])) as any;

      if (settingsRes?.data) {
        setShowLiveCounts(settingsRes.data.show_live_counts);
      }

      const allTeachers: any[] = teachersRes?.data || [];
      let categoryTeachers: any[] = allTeachers;
      if (ctRes?.data !== null && ctRes?.data !== undefined && !ctRes.error) {
        const assignedIds = new Set<string>(ctRes.data.map((ct: any) => ct.teacher_id));
        categoryTeachers = allTeachers.filter((t) => assignedIds.has(t.id));
      }

      const votesMap: Record<string, number> = {};
      (totalsRes?.data || []).forEach((row: any) => {
        votesMap[row.teacher_id] = row.total_votes;
      });

      const entries: LeaderboardEntry[] = categoryTeachers.map((t) => ({
        teacher_id: t.id,
        teacher_name: t.name,
        teacher_photo: t.photo_url || '',
        teacher_department: t.department,
        total_votes: votesMap[t.id] ?? 0,
        rank: 1,
      }));

      entries.sort((a, b) => b.total_votes - a.total_votes || a.teacher_name.localeCompare(b.teacher_name));

      const ranked = entries.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
      setLeaderboard(ranked);
    } catch {
      setLeaderboard(getCategoryFallbackLeaderboard(categoryId));
    } finally {
      setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchLeaderboard();

    const handleUpdate = () => {
      fetchLeaderboard();
    };

    window.addEventListener('td_votes_updated', handleUpdate);
    window.addEventListener('td_admin_teachers_updated', handleUpdate);
    window.addEventListener('td_admin_categories_updated', handleUpdate);
    window.addEventListener('td_admin_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('td_votes_updated', handleUpdate);
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('td_admin_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchLeaderboard]);

  // Subscribe to Supabase Realtime changes on `vote_totals`
  useEffect(() => {
    if (!categoryId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`live_results_${categoryId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vote_totals',
          filter: `category_id=eq.${categoryId}`,
        },
        (payload) => {
          const updatedTotal = payload.new as { teacher_id: string; total_votes: number };
          if (updatedTotal?.teacher_id) {
            setLeaderboard((prev) => {
              const updatedList = prev.map((entry) => {
                if (entry.teacher_id === updatedTotal.teacher_id) {
                  return {
                    ...entry,
                    previous_rank: entry.rank,
                    total_votes: updatedTotal.total_votes,
                  };
                }
                return entry;
              });

              return updatedList
                .sort((a, b) => b.total_votes - a.total_votes || a.teacher_name.localeCompare(b.teacher_name))
                .map((item, idx) => ({ ...item, rank: idx + 1 }));
            });
          }
        }
      )
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId]);

  return {
    leaderboard,
    showLiveCounts,
    isLoading,
    isLiveConnected,
    error,
    refetch: fetchLeaderboard,
  };
}
