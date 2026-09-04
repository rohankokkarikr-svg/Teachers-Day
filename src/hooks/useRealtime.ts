import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
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

  const categoryIdRef = useRef(categoryId);
  categoryIdRef.current = categoryId;

  // Fetch leaderboard for category
  const fetchLeaderboard = useCallback(async (isSilent = false) => {
    const currentCatId = categoryIdRef.current;
    const s = getLocalStorage<VotingSettings | null>('td_admin_settings', null);
    if (s) setShowLiveCounts(s.show_live_counts);

    if (!currentCatId) {
      setLeaderboard(getCategoryFallbackLeaderboard());
      if (!isSilent) setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setLeaderboard(getCategoryFallbackLeaderboard(currentCatId));
      if (!isSilent) setIsLoading(false);
      return;
    }

    if (!isSilent) setIsLoading(true);
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
        .eq('category_id', currentCatId);

      const totalsPromise = supabase
        .from('vote_totals')
        .select('teacher_id, total_votes')
        .eq('category_id', currentCatId);

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

      // Teachers list with robust fallback to local/cached teachers with photos
      const dbTeachers: any[] = teachersRes?.data || [];
      const allTeachers: any[] = dbTeachers.length > 0 ? dbTeachers : getAllTeachers().filter((t) => t.is_active !== false);

      // Category assignments
      const localAssignments = getLocalStorage<Record<string, string[]>>(
        'td_category_teacher_assignments',
        INITIAL_CATEGORY_ASSIGNMENTS
      );
      let categoryTeachers: any[] = allTeachers;
      if (ctRes?.data && ctRes.data.length > 0) {
        const assignedIds = new Set<string>(ctRes.data.map((ct: any) => ct.teacher_id));
        categoryTeachers = allTeachers.filter((t) => assignedIds.has(t.id));
      } else if (localAssignments[currentCatId]) {
        const assignedIds = new Set<string>(localAssignments[currentCatId]);
        categoryTeachers = allTeachers.filter((t) => assignedIds.has(t.id));
      }

      const votesMap: Record<string, number> = {};
      const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
      const catLocalVotes = localTotals[currentCatId] || {};

      if (totalsRes?.data && totalsRes.data.length > 0) {
        totalsRes.data.forEach((row: any) => {
          votesMap[row.teacher_id] = row.total_votes;
        });

        // Sync Supabase totals to local cache for offline/instant hydration
        const updatedTotals = { ...localTotals, [currentCatId]: votesMap };
        setLocalStorage('td_category_vote_totals', updatedTotals);
      } else {
        // Use local tallies if Supabase had 0 rows for this category
        Object.assign(votesMap, catLocalVotes);
      }

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
      setLeaderboard(getCategoryFallbackLeaderboard(currentCatId));
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  // Initial and window event listeners
  useEffect(() => {
    fetchLeaderboard();

    const handleUpdate = () => {
      fetchLeaderboard(true);
    };

    window.addEventListener('td_votes_updated', handleUpdate);
    window.addEventListener('td_system_reset', handleUpdate);
    window.addEventListener('td_admin_teachers_updated', handleUpdate);
    window.addEventListener('td_admin_categories_updated', handleUpdate);
    window.addEventListener('td_admin_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('td_votes_updated', handleUpdate);
      window.removeEventListener('td_system_reset', handleUpdate);
      window.removeEventListener('td_admin_teachers_updated', handleUpdate);
      window.removeEventListener('td_admin_categories_updated', handleUpdate);
      window.removeEventListener('td_admin_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchLeaderboard]);

  // Regular Database Polling & Mobile Visibility Reconnection (every 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLeaderboard(true);
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLeaderboard(true);
      }
    };

    const handleOnline = () => {
      fetchLeaderboard(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchLeaderboard]);

  // Subscribe to Supabase Realtime Channels:
  // 1. Broadcast channel 'td_global_realtime' for sub-50ms instant propagation across all mobiles
  // 2. Postgres CDC changes on 'vote_totals', 'vote_submissions', and 'voting_settings'
  useEffect(() => {
    if (!categoryId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`live_results_stream_${categoryId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      // A. Listen to instant broadcast votes from any student phone
      .on('broadcast', { event: 'vote_submitted' }, (payload) => {
        const data = payload.payload as {
          categoryId: string;
          votes?: Record<string, number>;
        };

        if (data?.categoryId === categoryId) {
          // Optimistically update counts in-memory for instant visual responsiveness
          if (data.votes) {
            setLeaderboard((prev) => {
              const updated = prev.map((entry) => {
                const added = data.votes ? data.votes[entry.teacher_id] || 0 : 0;
                return added > 0
                  ? { ...entry, total_votes: entry.total_votes + added }
                  : entry;
              });
              return updated
                .sort((a, b) => b.total_votes - a.total_votes || a.teacher_name.localeCompare(b.teacher_name))
                .map((item, idx) => ({ ...item, rank: idx + 1 }));
            });
          }
          // Fetch exact authoritative database records
          fetchLeaderboard(true);
        }
      })
      // B. Listen to direct Postgres WAL database changes on `vote_totals`
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vote_totals',
        },
        (payload) => {
          const updatedRow = payload.new as { category_id?: string; teacher_id?: string; total_votes?: number };
          if (updatedRow && updatedRow.category_id === categoryId && updatedRow.teacher_id) {
            setLeaderboard((prev) => {
              const updatedList = prev.map((entry) => {
                if (entry.teacher_id === updatedRow.teacher_id) {
                  return {
                    ...entry,
                    previous_rank: entry.rank,
                    total_votes: updatedRow.total_votes ?? entry.total_votes,
                  };
                }
                return entry;
              });

              return updatedList
                .sort((a, b) => b.total_votes - a.total_votes || a.teacher_name.localeCompare(b.teacher_name))
                .map((item, idx) => ({ ...item, rank: idx + 1 }));
            });
          } else {
            fetchLeaderboard(true);
          }
        }
      )
      // C. Listen to new vote submissions in real-time
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vote_submissions',
        },
        () => {
          fetchLeaderboard(true);
        }
      )
      // D. Listen to admin voting settings updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voting_settings',
        },
        (payload) => {
          const newSettings = payload.new as { show_live_counts?: boolean };
          if (newSettings?.show_live_counts !== undefined) {
            setShowLiveCounts(newSettings.show_live_counts);
          }
        }
      )
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId, fetchLeaderboard]);

  return {
    leaderboard,
    showLiveCounts,
    isLoading,
    isLiveConnected,
    error,
    refetch: fetchLeaderboard,
  };
}
