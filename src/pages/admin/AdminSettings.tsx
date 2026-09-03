import { useState } from 'react';
import { Settings, ShieldCheck, Database, Server, AlertTriangle, RotateCcw, Trash2, CheckCircle2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useAdmin } from '../../hooks/useAdmin';
import { toast } from '../../components/ui/Toast';

export default function AdminSettings() {
  const { settings, isLoading, masterResetSystem } = useAdmin();
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleOpenReset = () => {
    setConfirmText('');
    setShowResetModal(true);
  };

  const handleExecuteReset = async () => {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      toast.error('Confirmation Mismatch', 'Please type RESET to confirm.');
      return;
    }

    setIsResetting(true);
    const res = await masterResetSystem();
    setIsResetting(false);

    if (res.success) {
      setShowResetModal(false);
      setConfirmText('');
      toast.success(
        'System Master Reset Complete',
        'All student ballots, votes, appreciation notes, and database tallies have been wiped.'
      );
    } else {
      toast.error('Reset Failed', res.error || 'Could not complete system reset.');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Settings className="text-primary-400" size={24} />
          Platform System Settings
        </h1>
        <p className="section-subtitle">
          Configuration, system health, and master data management for Teachers' Day Platform 2026
        </p>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Voting Rules Config */}
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Voting Parameters</h2>
              <p className="text-xs text-surface-400">Database-enforced parameters</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-surface-700/50">
              <span className="text-surface-400">Votes Per Category</span>
              <span className="text-white font-bold">5 Votes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-700/50">
              <span className="text-surface-400">Duplicate Submission Policy</span>
              <span className="text-emerald-400 font-semibold">Strict 1 per student/category</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-surface-400">Atomic Validation RPC</span>
              <Badge variant="success">Active</Badge>
            </div>
          </div>
        </Card>

        {/* Database Connection */}
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Database Status</h2>
              <p className="text-xs text-surface-400">Supabase PostgreSQL engine</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-surface-700/50">
              <span className="text-surface-400">Realtime Engine</span>
              <Badge variant="live">Connected</Badge>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-700/50">
              <span className="text-surface-400">Row Level Security</span>
              <Badge variant="success">Enforced</Badge>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-surface-400">Voting State</span>
              <Badge variant={settings?.is_voting_open ? 'success' : 'danger'}>
                {isLoading ? 'Loading...' : settings?.is_voting_open ? 'Voting Open' : 'Voting Closed'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Danger Zone: Master Factory Reset */}
      <Card className="border border-rose-500/30 bg-rose-500/5 p-6 rounded-2xl space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Danger Zone: Master Data & System Reset</h2>
              <Badge variant="danger">High Impact</Badge>
            </div>
            <p className="text-xs text-surface-300 mt-1 leading-relaxed">
              This action will completely wipe all votes, ballots, appreciation wall messages, registered voter activity, audit logs, and leaderboards across both the user side, admin dashboard, and database tables.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-rose-500/20">
          <div className="text-xs text-surface-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-rose-400" />
            <span>Use this to start a fresh Teachers' Day voting event</span>
          </div>

          <Button
            variant="primary"
            className="!bg-rose-600 hover:!bg-rose-700 text-white shadow-lg shadow-rose-900/40"
            icon={<RotateCcw size={16} />}
            onClick={handleOpenReset}
          >
            RESET ENTIRE SYSTEM & DATABASE
          </Button>
        </div>
      </Card>

      {/* System Platform Info */}
      <Card variant="flat" className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Server className="text-surface-400" size={20} />
          <div>
            <p className="text-sm font-semibold text-white">Platform Version</p>
            <p className="text-xs text-surface-400">Teachers' Day Voting Platform v1.0.0 (Production Release)</p>
          </div>
        </div>
        <Badge variant="neutral">Vercel Ready</Badge>
      </Card>

      {/* Master Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => !isResetting && setShowResetModal(false)}
        title="Confirm Master Factory Reset"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
            <p className="font-bold text-white text-sm flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-rose-400" />
              Warning: Permanent Data Wipe
            </p>
            <p>
              This will permanently delete:
            </p>
            <ul className="list-disc list-inside space-y-1 text-surface-200">
              <li>All votes cast across every award category</li>
              <li>All student ballots, device locks, and voter registration records</li>
              <li>All appreciation wall notes and moderation logs</li>
              <li>All dashboard tallies and real-time activity streams</li>
              <li>Database tables in Supabase (vote_items, vote_submissions, vote_totals, appreciation_messages, student profiles, admin_actions)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider">
              Type <span className="text-white font-mono font-bold bg-surface-800 px-1.5 py-0.5 rounded border border-surface-600">RESET</span> to confirm:
            </label>
            <Input
              placeholder="Type RESET here..."
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-700/50">
            <Button
              type="button"
              variant="secondary"
              disabled={isResetting}
              onClick={() => setShowResetModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="!bg-rose-600 hover:!bg-rose-700 text-white"
              icon={<Trash2 size={16} />}
              isLoading={isResetting}
              disabled={confirmText.trim().toUpperCase() !== 'RESET' || isResetting}
              onClick={handleExecuteReset}
            >
              Wipe & Reset Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
