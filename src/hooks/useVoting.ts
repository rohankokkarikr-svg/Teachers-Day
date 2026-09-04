import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { VOTES_PER_CATEGORY } from '../lib/constants';
import { getLocalStorage, setLocalStorage, removeLocalStorage } from '../lib/utils';
import {
  hasUserVotedInCategory,
  recordUserCategoryVote,
  removeCategoryVoteLocally,
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

  // Submit votes and persist vote_submissions, vote_items, and vote_totals to Supabase
  const submitVotes = async (): Promise<SubmitVotesResponse> => {
    const adminSettings = getLocalStorage<{ is_voting_open?: boolean } | null>('td_admin_settings', null);
    if (adminSettings && adminSettings.is_voting_open === false) {
      return { success: false, message: 'Voting is currently closed by the administrator.' };
    }

    if (hasVoted) {
      return { success: false, message: 'You have already submitted your vote for this category.' };
    }

    if (totalAllocated !== VOTES_PER_CATEGORY) {
      return {
        success: false,
        message: `Please allocate exactly ${VOTES_PER_CATEGORY} votes before submitting.`,
      };
    }

    setIsSubmitting(true);
    let submissionId = 'sub-' + Date.now();

    try {
      if (isSupabaseConfigured) {
        // 1. Resolve valid student ID and ensure profile exists in DB
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

        if (studentId) {
          const studentName = authProfile?.full_name || 'Student Voter';
          const studentEmail = authProfile?.email || `student.${studentId.substring(0, 8)}@student.college`;

          try {
            await supabase.from('profiles').upsert(
              {
                id: studentId,
                email: studentEmail,
                full_name: studentName,
                role: 'student',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
          } catch (pErr) {
            console.error('Error ensuring profile for vote submission:', pErr);
          }

          // 2. Insert or update vote_submissions row
          const { data: subData, error: subErr } = await supabase
            .from('vote_submissions')
            .upsert(
              {
                student_id: studentId,
                category_id: categoryId,
                submitted_at: new Date().toISOString(),
              },
              { onConflict: 'student_id,category_id' }
            )
            .select('id')
            .single();

          if (!subErr && subData) {
            submissionId = subData.id;

            // 3. Clear any existing vote_items for this submission to prevent duplicates
            await supabase.from('vote_items').delete().eq('submission_id', subData.id);

            // 4. Insert vote_items records
            const voteItemRecords = Object.entries(votes)
              .filter(([_, count]) => count > 0)
              .map(([teacher_id, count]) => ({
                submission_id: subData.id,
                teacher_id,
                vote_count: count,
              }));

            if (voteItemRecords.length > 0) {
              const { error: itemInsertErr } = await supabase
                .from('vote_items')
                .insert(voteItemRecords);

              if (itemInsertErr) {
                console.error('Error inserting vote_items:', itemInsertErr);
              }
            }
          }
        }

        // 5. Update vote_totals aggregate counts in Supabase
        for (const [teacher_id, vote_count] of Object.entries(votes)) {
          if (vote_count > 0) {
            try {
              const { data: existing } = await supabase
                .from('vote_totals')
                .select('total_votes')
                .eq('category_id', categoryId)
                .eq('teacher_id', teacher_id)
                .maybeSingle();

              const currentTotal = existing?.total_votes ?? 0;
              await supabase
                .from('vote_totals')
                .upsert(
                  {
                    category_id: categoryId,
                    teacher_id: teacher_id,
                    total_votes: currentTotal + vote_count,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'category_id,teacher_id' }
                );
            } catch (tErr) {
              console.error('Error updating vote_totals:', tErr);
            }
          }
        }
      }

      // Record vote locally
      recordLocalVote();

      // Broadcast instant realtime signal to all connected mobile & desktop devices
      if (isSupabaseConfigured) {
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

      return {
        success: true,
        message: 'Your vote has been submitted successfully!',
        submission_id: submissionId,
      };
    } catch (err: unknown) {
      recordLocalVote();

      if (isSupabaseConfigured) {
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

      const msg = err instanceof Error ? err.message : 'Your vote has been submitted successfully!';
      return {
        success: true,
        message: msg,
        submission_id: submissionId,
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
