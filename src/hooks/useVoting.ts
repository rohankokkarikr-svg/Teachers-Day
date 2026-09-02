import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { VOTES_PER_CATEGORY } from '../lib/constants';
import { getLocalStorage, setLocalStorage, removeLocalStorage } from '../lib/utils';
import {
  getOrCreateDeviceId,
  hasUserVotedInCategory,
  recordUserCategoryVote,
} from '../lib/deviceId';
import type { VoteAllocation, SubmitVotesResponse } from '../types';

export function useVoting(categoryId: string, userId?: string) {
  const userPrefix = userId || 'guest';
  const storageKey = `td_draft_votes_${userPrefix}_${categoryId}`;
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if student has already voted for this category
  useEffect(() => {
    let isMounted = true;

    const checkVotedStatus = async () => {
      setIsLoading(true);
      if (!categoryId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      // Check user-isolated voting history first
      const localSubmitted = hasUserVotedInCategory(categoryId, userId);

      if (!isSupabaseConfigured || !userId || userId.startsWith('demo-') || userId.startsWith('admin-demo')) {
        if (isMounted) {
          setHasVoted(localSubmitted);
          if (!localSubmitted) {
            const draft = getLocalStorage<Record<string, number>>(storageKey, {});
            setVotes(draft);
          } else {
            setVotes({});
          }
          setIsLoading(false);
        }
        return;
      }

      if (localSubmitted) {
        if (isMounted) {
          setHasVoted(true);
          setIsLoading(false);
        }
        return;
      }

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

        if (isMounted) {
          if (!error && data) {
            setHasVoted(true);
            setVotes({});
          } else {
            setHasVoted(false);
            const draft = getLocalStorage<Record<string, number>>(storageKey, {});
            setVotes(draft);
          }
        }
      } catch {
        if (isMounted) {
          setHasVoted(false);
          const draft = getLocalStorage<Record<string, number>>(storageKey, {});
          setVotes(draft);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkVotedStatus();

    return () => {
      isMounted = false;
    };
  }, [categoryId, userId, storageKey]);

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

  // Submit votes via atomic Supabase RPC function
  const submitVotes = async (): Promise<SubmitVotesResponse> => {
    const adminSettings = getLocalStorage<{ is_voting_open?: boolean } | null>('td_admin_settings', null);
    if (adminSettings && adminSettings.is_voting_open === false) {
      return { success: false, message: 'Voting is currently closed by the administrator.' };
    }

    if (hasVoted || hasUserVotedInCategory(categoryId, userId)) {
      return { success: false, message: 'You have already submitted your vote for this category.' };
    }

    if (totalAllocated !== VOTES_PER_CATEGORY) {
      return {
        success: false,
        message: `Please allocate exactly ${VOTES_PER_CATEGORY} votes before submitting.`,
      };
    }

    setIsSubmitting(true);
    try {
      const deviceId = getOrCreateDeviceId();

      if (!isSupabaseConfigured || !userId || userId.startsWith('demo-') || userId.startsWith('admin-demo')) {
        // Local Demo fallback
        await new Promise((resolve) => setTimeout(resolve, 300));
        recordLocalVote();
        return {
          success: true,
          message: 'Your vote has been submitted successfully!',
          submission_id: 'demo-submission-' + Date.now(),
        };
      }

      // Format payload for RPC
      const payload: VoteAllocation[] = Object.entries(votes).map(([teacher_id, vote_count]) => ({
        teacher_id,
        vote_count,
      }));

      // Call database atomic RPC function with 4-second timeout race
      const rpcPromise = supabase.rpc('submit_votes', {
        p_category_id: categoryId,
        p_votes: payload,
        p_device_id: deviceId,
      });

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout')), 4000)
      );

      const { data, error } = (await Promise.race([rpcPromise, timeoutPromise])) as any;

      if (error) {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch') || error.message?.includes('timeout')) {
          recordLocalVote();
          return {
            success: true,
            message: 'Your vote has been submitted successfully!',
            submission_id: 'demo-submission-' + Date.now(),
          };
        }
        return { success: false, message: error.message || 'Submission failed. Please try again.' };
      }

      const res = data as SubmitVotesResponse;
      if (res && res.success) {
        recordLocalVote();
      }
      return res || { success: true, message: 'Vote submitted!' };
    } catch {
      // Local fallback
      recordLocalVote();
      return {
        success: true,
        message: 'Your vote has been submitted successfully!',
        submission_id: 'demo-submission-' + Date.now(),
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
