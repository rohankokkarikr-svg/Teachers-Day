import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Lock, Unlock, Download, Presentation } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { useAdmin } from '../../hooks/useAdmin';
import { ROUTES } from '../../lib/constants';
import { toast } from '../../components/ui/Toast';

export default function AdminResults() {
  const navigate = useNavigate();
  const { settings, isLoading, finalizeResults, exportResultsCSV } = useAdmin();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

  const isFinalized = settings?.results_finalized || false;

  const handleToggleFinalize = async () => {
    if (isFinalized) {
      setShowUnlockConfirm(true);
    } else {
      setShowLockConfirm(true);
    }
  };

  const handleConfirmLock = async () => {
    setIsUpdating(true);
    const res = await finalizeResults(true);
    setIsUpdating(false);
    setShowLockConfirm(false);

    if (res.success) {
      toast.success('Results Finalized!', 'Vote counts are now locked and immutable.');
    } else {
      toast.error('Error', res.error || 'Failed to finalize results.');
    }
  };

  const handleConfirmUnlock = async () => {
    setIsUpdating(true);
    const res = await finalizeResults(false);
    setIsUpdating(false);
    setShowUnlockConfirm(false);

    if (res.success) {
      toast.warning('Results Unlocked', 'Voting settings have been restored.');
    } else {
      toast.error('Error', res.error || 'Failed to unlock results.');
    }
  };

  const handleExportCSV = async () => {
    const res = await exportResultsCSV();
    if (res.success) {
      toast.success('Export Successful', 'Results CSV file downloaded.');
    } else {
      toast.error('Export Error', res.error || 'Failed to export CSV.');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Trophy className="text-gold-400" size={24} />
            Results Finalization & Export
          </h1>
          <p className="section-subtitle">
            Lock final vote totals, export results to CSV/Excel, and launch projector Event Mode
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="gold"
            icon={<Presentation size={16} />}
            onClick={() => navigate(ROUTES.EVENT_MODE)}
          >
            Launch Event Mode
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="card" />
      ) : (
        <div className="space-y-6">
          {/* Status Card */}
          <Card className={`border-l-4 ${isFinalized ? 'border-l-gold-500' : 'border-l-primary-500'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-white">Results Lock Status</h2>
                  <Badge variant={isFinalized ? 'gold' : 'neutral'}>
                    {isFinalized ? '🔒 FINALIZED & LOCKED' : '🔓 DRAFT / LIVE'}
                  </Badge>
                </div>
                <p className="text-xs text-surface-400">
                  {isFinalized
                    ? 'Final results are immutable. No further votes can be accepted or modified.'
                    : 'Results are live. Finalizing will lock vote totals and close student voting.'}
                </p>
              </div>

              <Button
                variant={isFinalized ? 'outline' : 'gold'}
                icon={isFinalized ? <Unlock size={16} /> : <Lock size={16} />}
                isLoading={isUpdating}
                onClick={handleToggleFinalize}
              >
                {isFinalized ? 'Unlock Results' : '🔒 FINALIZE RESULTS NOW'}
              </Button>
            </div>
          </Card>

          {/* Export Card */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">
                  Export Data to CSV / Excel
                </h2>
                <p className="text-xs text-surface-400">
                  Download category rankings, teacher-wise vote counts, and participation stats.
                </p>
              </div>

              <Button
                variant="primary"
                icon={<Download size={16} />}
                onClick={handleExportCSV}
              >
                Export CSV
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Lock Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLockConfirm}
        onClose={() => setShowLockConfirm(false)}
        onConfirm={handleConfirmLock}
        title="Finalize & Lock Award Results"
        message="Are you sure you want to finalize the results? This will lock all current vote counts and close voting."
        warning="Results will become immutable."
        confirmText="Yes, Lock Results Now"
        cancelText="Cancel"
        variant="gold"
        isLoading={isUpdating}
      />

      {/* Unlock Confirmation Modal */}
      <ConfirmationModal
        isOpen={showUnlockConfirm}
        onClose={() => setShowUnlockConfirm(false)}
        onConfirm={handleConfirmUnlock}
        title="Unlock Award Results"
        message="Are you sure you want to unlock finalized results?"
        warning="Requires admin privilege. Only perform this if vote adjustments are necessary."
        confirmText="Unlock Results"
        cancelText="Cancel"
        variant="danger"
        isLoading={isUpdating}
      />
    </div>
  );
}
