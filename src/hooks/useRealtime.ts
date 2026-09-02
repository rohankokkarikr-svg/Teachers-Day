import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage } from '../lib/utils';
import { getAllTeachers } from './useTeachers';
import type { LeaderboardEntry, VotingSettings } from '../types';

/**
 * Generates category leaderboard entries strictly based on actual submitted votes and dynamic admin teachers
 */
export function getCategoryFallbackLeaderboard(categoryId?: string): LeaderboardEntry[] {
  const catId = categoryId || '11111111-0000-0000-0000-000000000001';

  // Read all teachers (including any added/edited by admin)
  const teachers = getAllTeachers().filter((t) => t.is_active !== false);

  // Filter by category assignment if configured
  const assignments = getLocalStorage<Record<string, string[]>>('td_category_teacher_assignments', {});
  const catAssigned = assignments[catId] || [];
  const set = new Set(catAssigned);
  const categoryTeachers = teachers.filter((t) => set.has(t.id));

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
        .single();

      // 2. Fetch leaderboard via RPC
      const leaderboardPromise = supabase.rpc('get_category_leaderboard', {
        p_category_id: categoryId,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Leaderboard fetch timeout')), 2500)
      );

      const [settingsRes, rpcRes] = (await Promise.race([
        Promise.all([settingsPromise, leaderboardPromise]),
        timeoutPromise,
      ])) as any;

      if (settingsRes?.data) {
        setShowLiveCounts(settingsRes.data.show_live_counts);
      }

      if (rpcRes?.error) throw rpcRes.error;

      if (rpcRes?.data && rpcRes.data.length > 0) {
        const formatted: LeaderboardEntry[] = rpcRes.data.map((row: any) => ({
          teacher_id: row.teacher_id,
          teacher_name: row.teacher_name,
          teacher_photo: row.teacher_photo,
          teacher_department: row.department,
          total_votes: row.total_votes,
          rank: Number(row.rank),
        }));
        setLeaderboard(formatted);
      } else {
        setLeaderboard(getCategoryFallbackLeaderboard(categoryId));
      }
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
