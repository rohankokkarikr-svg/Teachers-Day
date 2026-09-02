import { useState } from 'react';
import { Vote, Power, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { useAdmin } from '../../hooks/useAdmin';
import { toast } from '../../components/ui/Toast';

export default function AdminVotingControl() {
  const { settings, isLoading, toggleVotingOpen, toggleShowLiveCounts } = useAdmin();

  const [isUpdating, setIsUpdating] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);

  const handleToggleVoting = async () => {
    if (!settings) return;
    if (settings.is_voting_open) {
      setShowCloseConfirmModal(true);
      return;
    }

    setIsUpdating(true);
    const res = await toggleVotingOpen(true);
    setIsUpdating(false);

    if (res.success) {
      toast.success('Voting Opened!', 'Students can now submit their votes.');
    } else {
      toast.error('Error', res.error || 'Failed to open voting.');
    }
  };

  const handleConfirmCloseVoting = async () => {
    setIsUpdating(true);
    const res = await toggleVotingOpen(false);
    setIsUpdating(false);
    setShowCloseConfirmModal(false);

    if (res.success) {
      toast.warning('Voting Closed!', 'No further vote submissions will be accepted.');
    } else {
      toast.error('Error', res.error || 'Failed to close voting.');
    }
  };

  const handleToggleCounts = async () => {
    if (!settings) return;
    setIsUpdating(true);
    const newShow = !settings.show_live_counts;
    const res = await toggleShowLiveCounts(newShow);
    setIsUpdating(false);

    if (res.success) {
      toast.success(newShow ? 'Live Counts Visible' : 'Live Counts Hidden');
    } else {
      toast.error('Error', res.error || 'Failed to update settings.');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Vote className="text-primary-400" size={24} />
          Voting Control Center
        </h1>
        <p className="section-subtitle">
          Open or close global student voting, control live result visibility, and enforce server-side constraints
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="card" />
      ) : (
        <div className="space-y-6">
          {/* Main Status Switch */}
          <Card className="border-l-4 border-l-primary-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-white">Global Voting Status</h2>
                  <Badge variant={settings?.is_voting_open ? 'success' : 'danger'}>
                    {settings?.is_voting_open ? '🟢 VOTING OPEN' : '🔴 VOTING CLOSED'}
                  </Badge>
                </div>
                <p className="text-xs text-surface-400">
                  {settings?.is_voting_open
                    ? 'Students are currently able to submit 5 votes per category.'
                    : 'Voting is locked. Any submission attempts from students will be rejected server-side.'}
                </p>
              </div>

              <Button
                variant={settings?.is_voting_open ? 'danger' : 'gold'}
                icon={<Power size={16} />}
                isLoading={isUpdating}
                onClick={handleToggleVoting}
                size="lg"
              >
                {settings?.is_voting_open ? 'CLOSE VOTING NOW' : 'OPEN VOTING NOW'}
              </Button>
            </div>
          </Card>

          {/* Visibility Controls */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-semibold text-white">Live Vote Counts Visibility</h2>
                  <Badge variant={settings?.show_live_counts ? 'primary' : 'neutral'}>
                    {settings?.show_live_counts ? 'Counts Visible' : 'Counts Hidden'}
                  </Badge>
                </div>
                <p className="text-xs text-surface-400">
                  {settings?.show_live_counts
                    ? 'Students can see exact vote totals on the live leaderboard.'
                    : 'Students can see leaderboard rankings, but exact vote numbers are hidden to build anticipation.'}
                </p>
              </div>

              <Button
                variant="secondary"
                icon={settings?.show_live_counts ? <EyeOff size={16} /> : <Eye size={16} />}
                isLoading={isUpdating}
                onClick={handleToggleCounts}
              >
                {settings?.show_live_counts ? 'Hide Exact Counts' : 'Show Exact Counts'}
              </Button>
            </div>
          </Card>

          {/* Security & Enforcement Specs */}
          <Card variant="flat" className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" size={16} />
              Server-Side Rule Enforcement
            </h3>
            <ul className="space-y-2 text-xs text-surface-300">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <strong>Atomic RPC Validation:</strong> Votes are validated on PostgreSQL server before insertion.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <strong>5-Vote Rule:</strong> Total votes for any category must equal exactly 5.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <strong>One Submission Rule:</strong> Database constraint `unique_student_category_vote` blocks duplicate votes.
              </li>
            </ul>
          </Card>
        </div>
      )}

      {/* Close Voting Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCloseConfirmModal}
        onClose={() => setShowCloseConfirmModal(false)}
        onConfirm={handleConfirmCloseVoting}
        title="Emergency Close Voting"
        message="Are you sure you want to close voting? All ongoing and new student vote submissions will be immediately rejected."
        warning="This action can be reopened at any time."
        confirmText="Yes, Close Voting Now"
        cancelText="Cancel"
        variant="danger"
        isLoading={isUpdating}
      />
    </div>
  );
}
