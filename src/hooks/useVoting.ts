import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { VOTES_PER_CATEGORY } from '../lib/constants';
import { getLocalStorage, setLocalStorage, removeLocalStorage } from '../lib/utils';
import {
  hasUserVotedInCategory,
  recordUserCategoryVote,
  removeCategoryVoteLocally,
  getOrCreateDeviceId,
} from '../lib/deviceId';
import type { SubmitVotesResponse, Profile } from '../types';

export function useVoting(categoryId: string, userId?: string) {
  const userPrefix = userId || 'guest';
  const storageKey = `td_draft_votes_${userPrefix}_${categoryId}`;
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if student has already voted for this category
  const checkVotedStatus = useCallback(async () => {
    setIsLoading(true);
    if (!categoryId) {
      setIsLoading(false);
      return;
    }

    // Check user-isolated voting history first
    const localSubmitted = hasUserVotedInCategory(categoryId, userId);

    if (!isSupabaseConfigured || !userId || userId.startsWith('demo-') || userId.startsWith('admin-demo')) {
      setHasVoted(localSubmitted);
      if (!localSubmitted) {
        const draft = getLocalStorage<Record<string, number>>(storageKey, {});
        setVotes(draft);
      } else {
        setVotes({});
      }
      setIsLoading(false);
      return;
    }

    // When Supabase is active: query database as ground truth
    try {
      const queryPromise = supabase
        .from('vote_submissions')
        .select('id')
        .eq('student_id', userId)
        .eq('category_id', categoryId)
        .maybeSingle();

      // 2-second timeout race to prevent hanging
      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 2000)
      );

      const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;

      if (!error && data) {
        // Confirmed voted in Supabase
        setHasVoted(true);
        setVotes({});
      } else if (!error && !data) {
        // Confirmed NOT voted in Supabase (e.g. fresh state or after master reset)
        setHasVoted(false);
        removeCategoryVoteLocally(categoryId, userId);
        const draft = getLocalStorage<Record<string, number>>(storageKey, {});
        setVotes(draft);
      } else {
        // Fallback to local
        setHasVoted(localSubmitted);
        if (!localSubmitted) {
          const draft = getLocalStorage<Record<string, number>>(storageKey, {});
          setVotes(draft);
        }
      }
    } catch {
      // In case of timeout or connection issue, fallback to local state
      setHasVoted(localSubmitted);
      if (!localSubmitted) {
        const draft = getLocalStorage<Record<string, number>>(storageKey, {});
        setVotes(draft);
      }
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, userId, storageKey]);

  useEffect(() => {
    checkVotedStatus();

    const handleUpdate = () => {
      checkVotedStatus();
    };

    window.addEventListener('td_votes_updated', handleUpdate);
    window.addEventListener('td_system_reset', handleUpdate);
    window.addEventListener('td_admin_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('td_votes_updated', handleUpdate);
      window.removeEventListener('td_system_reset', handleUpdate);
      window.removeEventListener('td_admin_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [checkVotedStatus]);

  // Total votes currently allocated
  const totalAllocated = Object.values(votes).reduce((sum, count) => sum + count, 0);
  const remaining = VOTES_PER_CATEGORY - totalAllocated;
  const isComplete = totalAllocated === VOTES_PER_CATEGORY;

  // Increment vote for a teacher
  const incrementVote = useCallback(
    (teacherId: string) => {
      if (hasVoted || totalAllocated >= VOTES_PER_CATEGORY) return;

      setVotes((prev) => {
        const current = prev[teacherId] || 0;
        const updated = { ...prev, [teacherId]: current + 1 };
        setLocalStorage(storageKey, updated);
        return updated;
      });
    },
    [hasVoted, totalAllocated, storageKey]
  );

  // Decrement vote for a teacher
  const decrementVote = useCallback(
    (teacherId: string) => {
      if (hasVoted || !votes[teacherId] || votes[teacherId] <= 0) return;

      setVotes((prev) => {
        const current = prev[teacherId];
        const updated = { ...prev };
        if (current <= 1) {
          delete updated[teacherId];
        } else {
          updated[teacherId] = current - 1;
        }
        setLocalStorage(storageKey, updated);
        return updated;
      });
    },
    [hasVoted, votes, storageKey]
  );

  // Reset votes for category
  const resetVotes = useCallback(() => {
    if (hasVoted) return;
    setVotes({});
    removeLocalStorage(storageKey);
  }, [hasVoted, storageKey]);

  // Helper to record locally submitted category for this user
  const recordLocalVote = () => {
    setHasVoted(true);

    // Record dynamic vote tallies for this category
    try {
      const existingTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
      const catTotals = { ...(existingTotals[categoryId] || {}) };
      Object.entries(votes).forEach(([tId, count]) => {
        catTotals[tId] = (catTotals[tId] || 0) + count;
      });
      existingTotals[categoryId] = catTotals;
      setLocalStorage('td_category_vote_totals', existingTotals);
    } catch {
      // Ignore storage errors
    }

    setVotes({});
    removeLocalStorage(storageKey);
    recordUserCategoryVote(categoryId, userId);
    window.dispatchEvent(new Event('td_votes_updated'));
  };

  // Submit votes atomically via PostgreSQL RPC function
  const submitVotes = async (): Promise<SubmitVotesResponse> => {
    // 1. Guard against concurrent clicks or multiple submissions
    if (isSubmitting) {
      return { success: false, message: 'Your vote is currently submitting. Please wait...' };
    }

    if (hasVoted) {
      return { success: false, message: 'You have already submitted your vote for this category.' };
    }

    const adminSettings = getLocalStorage<{ is_voting_open?: boolean } | null>('td_admin_settings', null);
    if (adminSettings && adminSettings.is_voting_open === false) {
      return { success: false, message: 'Voting is currently closed by the administrator.' };
    }

    if (totalAllocated !== VOTES_PER_CATEGORY) {
      return {
        success: false,
        message: `Please allocate exactly ${VOTES_PER_CATEGORY} votes before submitting.`,
      };
    }

    setIsSubmitting(true);

    // 2. Generate client idempotency UUID to protect against retries or duplicate network requests
    const clientSubmissionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '33333333-0000-0000-0000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');

    // 3. Format atomic vote allocation payload
    const votePayload = Object.entries(votes)
      .filter(([_, count]) => count > 0)
      .map(([teacher_id, count]) => ({
        teacher_id,
        vote_count: count,
      }));

    try {
      if (isSupabaseConfigured) {
        // Resolve student UUID
        let studentId = userId;
        const isValidUUID =
          studentId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);

        const authProfile = getLocalStorage<Profile | null>('td_auth_profile', null);
        if (
          !isValidUUID &&
          authProfile?.id &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authProfile.id)
        ) {
          studentId = authProfile.id;
        }

        const deviceId = getOrCreateDeviceId();

        // 4. ATOMIC DATABASE RPC: Execute the single transactional vote submission in PostgreSQL
        let rpcRes: any = null;
        let rpcErr: any = null;

        try {
          const rpcPromise = supabase.rpc('submit_votes', {
            p_category_id: categoryId,
            p_votes: votePayload,
            p_student_id: studentId || null,
            p_device_id: deviceId || null,
            p_submission_id: clientSubmissionId,
          });

          const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
            setTimeout(() => reject(new Error('Submission timed out. Please check your connection.')), 8000)
          );

          const result = (await Promise.race([rpcPromise, timeoutPromise])) as any;
          rpcRes = result.data;
          rpcErr = result.error;

          // If legacy signature is active before Migration 011 is run in SQL Editor
          if (rpcErr && rpcErr.code === 'PGRST202') {
            const fallbackPromise = supabase.rpc('submit_votes', {
              p_category_id: categoryId,
              p_votes: votePayload,
              p_device_id: deviceId || null,
            });
            const fallbackResult = (await Promise.race([fallbackPromise, timeoutPromise])) as any;
            rpcRes = fallbackResult.data;
            rpcErr = fallbackResult.error;
          }
        } catch (timeoutErr: any) {
          rpcErr = timeoutErr;
        }

        if (rpcErr) {
          console.error('submit_votes RPC Error:', rpcErr);
          const errMsg = rpcErr.message || 'Submission failed. Please try again.';
          return { success: false, message: errMsg };
        }

        if (rpcRes && rpcRes.success === false) {
          if (rpcRes.message && rpcRes.message.includes('already submitted')) {
            recordLocalVote();
          }
          return { success: false, message: rpcRes.message || 'Submission was rejected by the server.' };
        }

        // Broadcast instant notification for live leaderboards
        try {
          const categoryChannel = supabase.channel(`live_results_stream_${categoryId}`);
          categoryChannel.send({
            type: 'broadcast',
            event: 'vote_submitted',
            payload: {
              categoryId,
              votes,
              timestamp: Date.now(),
            },
          });
        } catch {
          // Handled gracefully
        }
      }

      // Record successful vote locally
      recordLocalVote();

      return {
        success: true,
        message: 'Your vote has been submitted successfully!',
        submission_id: clientSubmissionId,
      };
    } catch (err: unknown) {
      console.error('Submit votes exception:', err);
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      return {
        success: false,
        message: msg,
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    votes,
    totalAllocated,
    remaining,
    isComplete,
    hasVoted,
    isLoading,
    isSubmitting,
    incrementVote,
    decrementVote,
    resetVotes,
    submitVotes,
  };
}
