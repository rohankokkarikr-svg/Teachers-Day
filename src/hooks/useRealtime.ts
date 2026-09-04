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

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // Optimized Leaderboard Fetcher using PostgreSQL RPC or unified fast join
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
      // 1. Attempt single high-speed database RPC: get_category_leaderboard
      const rpcPromise = supabase.rpc('get_category_leaderboard', {
        p_category_id: currentCatId,
      });

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Leaderboard fetch timeout')), 3000)
      );

      const { data: rpcRows, error: rpcErr } = (await Promise.race([rpcPromise, timeoutPromise])) as any;

      if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
        // Hydrate photo URLs with fallback if blank
        const allCachedTeachers = getAllTeachers();
        const photoMap = new Map<string, string>();
        allCachedTeachers.forEach((t) => {
          if (t.photo_url) photoMap.set(t.id, t.photo_url);
        });

        const areLeaderboardsEqual = (a: LeaderboardEntry[], b: LeaderboardEntry[]) => {
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            if (
              a[i].teacher_id !== b[i].teacher_id ||
              a[i].total_votes !== b[i].total_votes ||
              a[i].rank !== b[i].rank
            ) {
              return false;
            }
          }
          return true;
        };

        const formattedEntries: LeaderboardEntry[] = rpcRows.map((r: any, idx: number) => ({
          teacher_id: r.teacher_id,
          teacher_name: r.teacher_name,
          teacher_photo: r.teacher_photo || photoMap.get(r.teacher_id) || '',
          teacher_department: r.teacher_department || r.department || '',
          total_votes: Number(r.total_votes) || 0,
          rank: Number(r.rank) || (idx + 1),
        }));

        setLeaderboard((prev) => (areLeaderboardsEqual(prev, formattedEntries) ? prev : formattedEntries));

        // Cache latest totals locally
        const votesMap: Record<string, number> = {};
        formattedEntries.forEach((e) => {
          votesMap[e.teacher_id] = e.total_votes;
        });
        const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
        setLocalStorage('td_category_vote_totals', { ...localTotals, [currentCatId]: votesMap });
        return;
      }

      // Fallback: Query vote_totals directly if RPC is not yet installed
      const totalsPromise = supabase
        .from('vote_totals')
        .select('teacher_id, total_votes')
        .eq('category_id', currentCatId);

      const [settingsRes, totalsRes] = (await Promise.all([
        supabase.from('voting_settings').select('show_live_counts').eq('id', 1).maybeSingle(),
        totalsPromise,
      ])) as any;

      if (settingsRes?.data) {
        setShowLiveCounts(settingsRes.data.show_live_counts);
      }

      const allTeachers = getAllTeachers().filter((t) => t.is_active !== false);
      const assignments = getLocalStorage<Record<string, string[]>>(
        'td_category_teacher_assignments',
        INITIAL_CATEGORY_ASSIGNMENTS
      );
      const catAssigned = assignments[currentCatId];
      const categoryTeachers = catAssigned !== undefined
        ? allTeachers.filter((t) => new Set(catAssigned).has(t.id))
        : allTeachers;

      const votesMap: Record<string, number> = {};
      const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
      const catLocalVotes = localTotals[currentCatId] || {};

      if (totalsRes?.data && totalsRes.data.length > 0) {
        totalsRes.data.forEach((row: any) => {
          votesMap[row.teacher_id] = row.total_votes;
        });
        setLocalStorage('td_category_vote_totals', { ...localTotals, [currentCatId]: votesMap });
      } else {
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

      const areLeaderboardsEqual = (a: LeaderboardEntry[], b: LeaderboardEntry[]) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (
            a[i].teacher_id !== b[i].teacher_id ||
            a[i].total_votes !== b[i].total_votes ||
            a[i].rank !== b[i].rank
          ) {
            return false;
          }
        }
        return true;
      };

      setLeaderboard((prev) => (areLeaderboardsEqual(prev, ranked) ? prev : ranked));
    } catch {
      setLeaderboard(getCategoryFallbackLeaderboard(currentCatId));
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  // Debounced & Throttled Refresh Scheduler to prevent Request Storms under high concurrency
  const scheduleDebouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) return; // Fetch already scheduled in window

    const now = Date.now();
    const elapsed = now - lastFetchTimeRef.current;
    // Debounce window of 800ms to collapse multiple simultaneous vote events
    const wait = Math.max(800 - elapsed, 200);

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      lastFetchTimeRef.current = Date.now();
      fetchLeaderboard(true);
    }, wait);
  }, [fetchLeaderboard]);

  // Initial and window event listeners
  useEffect(() => {
    fetchLeaderboard();

    const handleUpdate = () => {
      scheduleDebouncedFetch();
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
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [fetchLeaderboard, scheduleDebouncedFetch]);

  // Fallback Polling (30s, paused when hidden to preserve battery & bandwidth)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLeaderboard(true);
      }
    }, 30000);

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

  // Realtime Channel: Throttled subscription strictly on vote_totals for this category
  useEffect(() => {
    if (!categoryId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`live_results_stream_${categoryId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      // 1. Instant optimistic broadcast updates from student devices
      .on('broadcast', { event: 'vote_submitted' }, (payload) => {
        const data = payload.payload as {
          categoryId: string;
          votes?: Record<string, number>;
        };

        if (data?.categoryId === categoryId) {
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
          scheduleDebouncedFetch();
        }
      })
      // 2. Debounced PostgreSQL Realtime updates on vote_totals (filtered to this category)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vote_totals',
          filter: `category_id=eq.${categoryId}`,
        },
        () => {
          scheduleDebouncedFetch();
        }
      )
      // 3. Admin settings updates
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
  }, [categoryId, scheduleDebouncedFetch]);

  return {
    leaderboard,
    showLiveCounts,
    isLoading,
    isLiveConnected,
    error,
    refetch: fetchLeaderboard,
  };
}
