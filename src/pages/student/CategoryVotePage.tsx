import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Minus, Plus, CheckCircle2 } from 'lucide-react';
import { VOTES_PER_CATEGORY, ROUTES } from '../../lib/constants';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ProgressIndicator from '../../components/ui/ProgressIndicator';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import Badge from '../../components/ui/Badge';
import { getInitials, getLocalStorage } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useTeachers } from '../../hooks/useTeachers';
import { useVoting } from '../../hooks/useVoting';
import { toast } from '../../components/ui/Toast';

const avatarColors = [
  'from-primary-500 to-primary-700',
  'from-rose-500 to-rose-700',
  'from-gold-500 to-gold-700',
  'from-emerald-500 to-emerald-700',
  'from-violet-500 to-violet-700',
  'from-cyan-500 to-cyan-700',
];

export default function CategoryVotePage() {
  const { categoryId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { teachers, isLoading: loadingTeachers } = useTeachers(categoryId);
  const [isVotingOpen, setIsVotingOpen] = useState<boolean>(() => {
    const s = getLocalStorage<{ is_voting_open?: boolean } | null>('td_admin_settings', null);
    return s ? (s.is_voting_open ?? true) : true;
  });

  const {
    votes,
    totalAllocated,
    remaining,
    isComplete,
    hasVoted,
    isLoading: loadingVoting,
    isSubmitting,
    incrementVote,
    decrementVote,
    submitVotes,
  } = useVoting(categoryId, user?.id);

  useEffect(() => {
    const checkSettings = () => {
      const s = getLocalStorage<{ is_voting_open?: boolean } | null>('td_admin_settings', null);
      if (s) setIsVotingOpen(s.is_voting_open ?? true);
    };

    window.addEventListener('td_admin_settings_updated', checkSettings);
    window.addEventListener('storage', checkSettings);

    return () => {
      window.removeEventListener('td_admin_settings_updated', checkSettings);
      window.removeEventListener('storage', checkSettings);
    };
  }, []);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  const handleConfirmSubmission = async () => {
    const result = await submitVotes();
    if (result.success) {
      setShowConfirmModal(false);
      setIsSubmittedSuccess(true);
      toast.success('Vote Submitted!', 'Your votes have been securely recorded.');
    } else {
      toast.error('Submission Failed', result.message || 'Please try again.');
    }
  };

  const isLoading = loadingTeachers || loadingVoting;
  const showActionBar = !isLoading && teachers.length > 0 && !hasVoted;

  return (
    <div className={`page-container max-w-2xl mx-auto ${showActionBar ? 'pb-32' : 'pb-12'}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <button
          onClick={() => navigate(ROUTES.VOTE)}
          className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors mb-3 tap-target"
          aria-label="Back to categories"
        >
          <ArrowLeft size={16} />
          Back to Categories
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="section-title text-xl md:text-2xl">
                Award Category Voting
              </h1>
              {hasVoted && (
                <Badge variant="success" icon={<CheckCircle2 size={12} />}>
                  Submitted
                </Badge>
              )}
            </div>
            <p className="section-subtitle text-xs md:text-sm">
              Distribute your {VOTES_PER_CATEGORY} votes among the candidate teachers below
            </p>
          </div>
          <ProgressIndicator allocated={hasVoted ? VOTES_PER_CATEGORY : totalAllocated} size="md" />
        </div>
      </motion.div>

      {/* Already Voted Banner */}
      {hasVoted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card border-emerald-500/30 bg-emerald-500/10 p-4 mb-6 flex items-center gap-3"
        >
          <CheckCircle2 size={24} className="text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Your votes have been submitted!</p>
            <p className="text-xs text-surface-300">
              Votes in this category are finalized and cannot be modified.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(ROUTES.LIVE_RESULTS)}
          >
            View Results
          </Button>
        </motion.div>
      )}

      {/* Voting Closed Banner */}
      {!isVotingOpen && !hasVoted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card border-rose-500/30 bg-rose-500/10 p-4 mb-6"
        >
          <p className="text-sm font-semibold text-white">Voting is currently closed</p>
          <p className="text-xs text-surface-300">
            The administrator has closed voting submissions. Votes cannot be placed at this time.
          </p>
        </motion.div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <Card className="p-8 text-center glass-card">
          <p className="text-base font-semibold text-white mb-1">No Nominees Assigned Yet</p>
          <p className="text-xs text-surface-400 max-w-sm mx-auto mb-4">
            The administrator has not assigned candidate teachers to this award category yet. Please check back soon!
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.VOTE)}>
            Back to Categories
          </Button>
        </Card>
      ) : (
        /* Teacher Cards */
        <div className="space-y-3">
          <AnimatePresence>
            {teachers.map((teacher, index) => {
              const voteCount = votes[teacher.id] || 0;
              const hasVotes = voteCount > 0;

              return (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  layout
                >
                  <Card
                    variant={hasVotes ? 'selected' : 'default'}
                    padding="none"
                  >
                    <div className="flex items-center gap-3 p-4">
                      {/* Avatar / Photo */}
                      {teacher.photo_url ? (
                        <img
                          src={teacher.photo_url}
                          alt={teacher.name}
                          className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0 shadow-lg"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                            avatarColors[index % avatarColors.length]
                          } flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-lg`}
                        >
                          {getInitials(teacher.name)}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-[11px] text-surface-400 truncate">
                          {teacher.department}
                          {teacher.subject && ` · ${teacher.subject}`}
                        </p>
                        {teacher.tagline && (
                          <p className="text-[10px] text-surface-500 italic mt-0.5 truncate">
                            "{teacher.tagline}"
                          </p>
                        )}
                      </div>

                      {/* Vote Stepper */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => decrementVote(teacher.id)}
                          disabled={voteCount <= 0 || hasVoted || !isVotingOpen}
                          className="vote-stepper-btn"
                          aria-label={`Remove vote from ${teacher.name}`}
                        >
                          <Minus size={16} />
                        </motion.button>

                        <AnimatePresence mode="popLayout">
                          <motion.span
                            key={voteCount}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`vote-stepper-count ${
                              hasVotes ? 'text-primary-400' : 'text-surface-500'
                            }`}
                          >
                            {voteCount}
                          </motion.span>
                        </AnimatePresence>

                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => incrementVote(teacher.id)}
                          disabled={remaining <= 0 || hasVoted || !isVotingOpen}
                          className="vote-stepper-btn"
                          aria-label={`Add vote for ${teacher.name}`}
                        >
                          <Plus size={16} />
                        </motion.button>
                      </div>
                    </div>

                    {/* Vote bar visualization */}
                    {hasVotes && (
                      <div className="px-4 pb-3">
                        <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(voteCount / VOTES_PER_CATEGORY) * 100}%`,
                            }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      {showActionBar && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-30"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="border-t border-white/[0.08] bg-surface-950/95 backdrop-blur-xl">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              {isVotingOpen ? (
                <>
                  <div className="flex items-center gap-3">
                    <ProgressIndicator allocated={totalAllocated} size="sm" showLabel={false} />
                    <div>
                      <p className={`text-sm font-semibold ${isComplete ? 'text-emerald-400' : 'text-white'}`}>
                        {isComplete ? (
                          <span className="flex items-center gap-1">
                            <Check size={14} /> All 5 votes allocated
                          </span>
                        ) : (
                          `${remaining} vote${remaining !== 1 ? 's' : ''} remaining`
                        )}
                      </p>
                      <p className="text-[10px] text-surface-500">
                        {totalAllocated} of {VOTES_PER_CATEGORY} distributed
                      </p>
                    </div>
                  </div>

                  <Button
                    variant={isComplete ? 'gold' : 'primary'}
                    disabled={!isComplete || isSubmitting}
                    onClick={() => setShowConfirmModal(true)}
                    iconRight={<ArrowRight size={16} />}
                    className="flex-shrink-0"
                  >
                    Submit Votes
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold text-white">Voting is Closed</p>
                      <p className="text-[10px] text-surface-400">Submissions locked by administrator</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => navigate(ROUTES.LIVE_RESULTS)}
                    className="flex-shrink-0 text-xs"
                  >
                    View Live Results
                  </Button>
                </>
              )}
            </div>
            <div className="pb-safe" />
          </div>
        </motion.div>
      )}

      {/* Confirmation Warning Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmission}
        title="Confirm Vote Submission"
        message={`You are submitting ${totalAllocated} votes across your selected teachers.`}
        warning="Votes cannot be changed or resubmitted after confirmation."
        confirmText="Confirm & Submit"
        cancelText="Review Selection"
        variant="gold"
        isLoading={isSubmitting}
      />

      {/* Success Modal */}
      <ConfirmationModal
        isOpen={isSubmittedSuccess}
        onClose={() => {
          setIsSubmittedSuccess(false);
          navigate(ROUTES.VOTE);
        }}
        onConfirm={() => {
          setIsSubmittedSuccess(false);
          navigate(ROUTES.VOTE);
        }}
        title="Votes Successfully Submitted!"
        message="Thank you for participating! Your votes have been securely recorded in the database."
        confirmText="Back to Categories"
        cancelText="Close"
        variant="primary"
      />
    </div>
  );
}
