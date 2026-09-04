import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalStorage, setLocalStorage } from '../lib/utils';
import { getAllTeachers } from './useTeachers';
import {
  getCategoryTeacherAssignments,
  getDefaultCategoryTeachers,
} from '../data/initialCategories';
import { captureError, captureMetric, captureEvent, setRealtimeStatus, type RealtimeStatus } from '../lib/monitoring';
import type { LeaderboardEntry, VotingSettings } from '../types';

/**
 * Generates category leaderboard entries strictly based on actual submitted votes and dynamic admin teachers
 */
export function getCategoryFallbackLeaderboard(categoryId?: string): LeaderboardEntry[] {
  const catId = categoryId || '11111111-0000-0000-0000-000000000001';

  // Read all teachers (including any added/edited by admin)
  const teachers = getAllTeachers().filter((t) => t.is_active !== false);

  // Filter by category assignment if configured
  const assignments = getCategoryTeacherAssignments();
  const catAssigned = assignments[catId] || getDefaultCategoryTeachers({ id: catId });
  const categoryTeachers = catAssigned && catAssigned.length > 0
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
  const [realtimeState, setRealtimeState] = useState<RealtimeStatus>('DISCONNECTED');
  const [error, setError] = useState<string | null>(null);

  const categoryIdRef = useRef(categoryId);
  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const backoffDelayRef = useRef<number>(1000); // 1s initial backoff

  // Optimized Leaderboard Fetcher using PostgreSQL RPC
  const fetchLeaderboard = useCallback(async (isSilent = false, overrideCatId?: string) => {
    const currentCatId = overrideCatId || categoryIdRef.current;
    const s = getLocalStorage<VotingSettings | null>('td_admin_settings', null);
    if (s && isMountedRef.current) setShowLiveCounts(s.show_live_counts);

    if (!currentCatId) {
      if (isMountedRef.current) {
        setLeaderboard(getCategoryFallbackLeaderboard());
        if (!isSilent) setIsLoading(false);
      }
      return;
    }

    if (!isSupabaseConfigured) {
      if (isMountedRef.current) {
        setLeaderboard(getCategoryFallbackLeaderboard(currentCatId));
        if (!isSilent) setIsLoading(false);
      }
      return;
    }

    if (!isSilent && isMountedRef.current) setIsLoading(true);
    if (isMountedRef.current) setError(null);

    const startTime = Date.now();

    try {
      // Single canonical PostgreSQL RPC: get_category_leaderboard
      const rpcPromise = supabase.rpc('get_category_leaderboard', {
        p_category_id: currentCatId,
      });

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Leaderboard fetch timeout')), 4000)
      );

      const { data: rpcRows, error: rpcErr } = (await Promise.race([rpcPromise, timeoutPromise])) as {
        data: Array<{
          teacher_id: string;
          teacher_name: string;
          teacher_photo?: string;
          teacher_department?: string;
          department?: string;
          total_votes: number;
          rank: number;
        }> | null;
        error: { message: string } | null;
      };

      const fetchLatency = Date.now() - startTime;
      captureMetric('leaderboard_fetch_latency', fetchLatency, 'ms');

      if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
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

        const formattedEntries: LeaderboardEntry[] = rpcRows.map((r, idx) => ({
          teacher_id: r.teacher_id,
          teacher_name: r.teacher_name,
          teacher_photo: r.teacher_photo || photoMap.get(r.teacher_id) || '',
          teacher_department: r.teacher_department || r.department || '',
          total_votes: Number(r.total_votes) || 0,
          rank: Number(r.rank) || (idx + 1),
        }));

        if (isMountedRef.current) {
          setLeaderboard((prev) => (areLeaderboardsEqual(prev, formattedEntries) ? prev : formattedEntries));
        }

        // Cache latest totals locally
        const votesMap: Record<string, number> = {};
        formattedEntries.forEach((e) => {
          votesMap[e.teacher_id] = e.total_votes;
        });
        const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
        setLocalStorage('td_category_vote_totals', { ...localTotals, [currentCatId]: votesMap });
        return;
      }

      // If RPC returned empty list or had no rows yet, use category assigned teachers with 0 votes
      if (isMountedRef.current) {
        setLeaderboard(getCategoryFallbackLeaderboard(currentCatId));
      }
    } catch (err) {
      captureError(err, { categoryId: currentCatId }, 'leaderboard');
      if (isMountedRef.current) {
        setLeaderboard((prev) => (prev.length > 0 ? prev : getCategoryFallbackLeaderboard(currentCatId)));
      }
    } finally {
      if (!isSilent && isMountedRef.current) setIsLoading(false);
    }
  }, []);

  // Debounced & Throttled Refresh Scheduler (collapses bursts into 1 request)
  const scheduleDebouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) return;

    const now = Date.now();
    const elapsed = now - lastFetchTimeRef.current;
    // Debounce window of 500ms to coalesce rapid concurrent vote events
    const wait = Math.max(500 - elapsed, 150);

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      lastFetchTimeRef.current = Date.now();
      fetchLeaderboard(true);
    }, wait);
  }, [fetchLeaderboard]);

  // Sync categoryId change
  useEffect(() => {
    categoryIdRef.current = categoryId;
    if (categoryId) {
      fetchLeaderboard(false, categoryId);
    }
  }, [categoryId, fetchLeaderboard]);

  // Window event listeners (local updates, admin events, storage sync)
  useEffect(() => {
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
  }, [scheduleDebouncedFetch]);

  // Visibility-Aware Adaptive Fallback Polling
  useEffect(() => {
    const runAdaptivePoll = () => {
      if (document.visibilityState !== 'visible') return;

      // If realtime is healthy and connected, poll very sparsely (60s);
      // If realtime is disconnected, poll more regularly as fallback (20s).
      const pollInterval = isLiveConnected ? 60000 : 20000;
      fetchLeaderboard(true);
      return pollInterval;
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        runAdaptivePoll();
      }
    }, isLiveConnected ? 60000 : 20000);

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
  }, [fetchLeaderboard, isLiveConnected]);

  // Realtime Channel Management with Exponential Backoff Auto-Recovery
  useEffect(() => {
    isMountedRef.current = true;
    if (!categoryId || !isSupabaseConfigured) return;

    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      if (!isMountedRef.current) return;

      const channelName = `live_stream_${categoryId}`;
      activeChannel = supabase
        .channel(channelName)
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
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'voting_settings',
          },
          (payload) => {
            const newSettings = payload.new as { show_live_counts?: boolean };
            if (newSettings?.show_live_counts !== undefined && isMountedRef.current) {
              setShowLiveCounts(newSettings.show_live_counts);
            }
          }
        )
        .subscribe((status) => {
          if (!isMountedRef.current) return;

          if (status === 'SUBSCRIBED') {
            setIsLiveConnected(true);
            setRealtimeState('CONNECTED');
            setRealtimeStatus('CONNECTED');
            backoffDelayRef.current = 1000; // Reset backoff on success
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setIsLiveConnected(false);
            setRealtimeState('RECONNECTING');
            setRealtimeStatus('RECONNECTING');
            captureEvent('realtime_disconnected', 'realtime', { status, categoryId });

            // Exponential backoff reconnect: 1s, 2s, 4s, 8s, 16s, max 30s
            if (!reconnectTimerRef.current && isMountedRef.current) {
              const delay = backoffDelayRef.current;
              backoffDelayRef.current = Math.min(delay * 2, 30000);

              reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null;
                if (activeChannel) {
                  supabase.removeChannel(activeChannel);
                }
                setupSubscription();
                fetchLeaderboard(true);
              }, delay);
            }
          }
        });
    };

    setupSubscription();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
      setIsLiveConnected(false);
      setRealtimeState('DISCONNECTED');
      setRealtimeStatus('DISCONNECTED');
    };
  }, [categoryId, scheduleDebouncedFetch, fetchLeaderboard]);

  return {
    leaderboard,
    showLiveCounts,
    isLoading,
    isLiveConnected,
    realtimeState,
    error,
    refetch: fetchLeaderboard,
  };
}
