import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy,
  Activity,
  Radio,
  RefreshCw,
  Presentation,
  Download,
  Lock,
  Vote,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import LiveBadge from '../../components/ui/LiveBadge';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import Leaderboard from '../../components/results/Leaderboard';
import { useCategories } from '../../hooks/useCategories';
import { useRealtime } from '../../hooks/useRealtime';
import { useAdmin } from '../../hooks/useAdmin';
import { ROUTES } from '../../lib/constants';
import { toast } from '../../components/ui/Toast';

export default function AdminLiveResults() {
  const navigate = useNavigate();
  const { categories, isLoading: loadingCategories } = useCategories();
  const { settings, exportResultsCSV } = useAdmin();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Default to first category if none selected
  const activeCategoryId = selectedCategoryId || categories[0]?.id || '';
  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  const {
    leaderboard,
    isLoading: loadingLeaderboard,
    isLiveConnected,
    error,
    refetch,
  } = useRealtime(activeCategoryId);

  const isLoading = loadingCategories || loadingLeaderboard;
  const totalVotesCast = leaderboard.reduce((sum, item) => sum + item.total_votes, 0);
  const leadingTeacher = leaderboard[0];
  const hasVotes = totalVotesCast > 0 && leadingTeacher && leadingTeacher.total_votes > 0;
  const leadingShare = hasVotes
    ? Math.round((leadingTeacher.total_votes / totalVotesCast) * 100)
    : 0;

  const handleExportCSV = async () => {
    const res = await exportResultsCSV();
    if (res.success) {
      toast.success('Export Successful', 'Results CSV downloaded.');
    } else {
      toast.error('Export Failed', res.error || 'Failed to export CSV.');
    }
  };

  const handleManualSync = async () => {
    await refetch();
    toast.success('Live Results Synced', 'Leaderboard recalculated with latest database votes.');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="section-title flex items-center gap-2">
              <Trophy className="text-gold-400" size={24} />
              Admin Live Results & Command Center
            </h1>
            <LiveBadge />
          </div>
          <p className="section-subtitle">
            Real-time live voting leaderboard with zero missed votes & instant WebSocket replication
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} className={loadingLeaderboard ? 'animate-spin' : ''} />}
            onClick={handleManualSync}
            disabled={loadingLeaderboard}
          >
            Force Sync
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>

          <Button
            variant="gold"
            size="sm"
            icon={<Presentation size={14} />}
            onClick={() => navigate(ROUTES.EVENT_MODE)}
          >
            Event Mode
          </Button>
        </div>
      </motion.div>

      {/* Category Tabs */}
      {loadingCategories ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="button" className="!w-36 flex-shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((cat) => {
            const isSelected = cat.id === activeCategoryId;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-primary-500/30 to-indigo-600/30 text-white border border-primary-500/60 shadow-glow-primary'
                    : 'bg-surface-900/80 text-surface-400 border border-surface-800 hover:text-white hover:bg-surface-800/80'
                }`}
              >
                <span>{cat.icon || '🏆'}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Live Category Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <Card padding="sm" className="bg-surface-900/60 border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
              <Vote size={18} className="text-primary-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-surface-400">Category Votes</p>
              <p className="text-lg font-bold text-white tracking-tight">{totalVotesCast}</p>
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-surface-900/60 border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gold-500/10 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-gold-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-surface-400">Leading Nominee</p>
              <p className="text-xs font-bold text-white truncate">
                {hasVotes ? leadingTeacher.teacher_name : 'No votes yet'}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-surface-900/60 border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Activity size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-surface-400">Leader Share</p>
              <p className="text-lg font-bold text-emerald-400 tracking-tight">
                {hasVotes ? `${leadingShare}%` : '0%'}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="sm" className="bg-surface-900/60 border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
              <Radio
                size={18}
                className={isLiveConnected ? 'text-emerald-400 animate-pulse' : 'text-surface-500'}
              />
            </div>
            <div>
              <p className="text-[11px] font-medium text-surface-400">Live Status</p>
              <Badge variant={isLiveConnected ? 'success' : 'neutral'}>
                {isLiveConnected ? 'Connected' : 'Syncing'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Selected Category Detail Banner */}
      {activeCategory && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary-950/40 via-surface-900 to-surface-900 border border-primary-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{activeCategory.icon || '🏆'}</span>
              <h2 className="text-base font-bold text-white">{activeCategory.name}</h2>
              {settings?.results_finalized && (
                <Badge variant="gold" icon={<Lock size={12} />}>
                  Finalized & Locked
                </Badge>
              )}
            </div>
            <p className="text-xs text-surface-300 mt-0.5">{activeCategory.description}</p>
          </div>

          <div className="text-xs text-surface-400 flex items-center gap-3">
            <span>Nominees: <strong className="text-white">{leaderboard.length}</strong></span>
            <span>Total Ballots: <strong className="text-white">{Math.round(totalVotesCast / 5) || 0}</strong></span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass-card border-rose-500/30 p-4 text-center text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Leaderboard Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Live Standings & Medal Rankings</span>
            <span className="text-xs font-normal text-surface-400">({leaderboard.length} Teachers)</span>
          </h3>
          <span className="text-[11px] text-surface-400">
            Auto-refreshes on every vote
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
        ) : (
          <Leaderboard entries={leaderboard} showLiveCounts={true} />
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 rounded-xl bg-surface-900/50 border border-white/[0.04] text-xs text-surface-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span>Results view restricted exclusively to Admin Panel with real-time replication.</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.ADMIN_FINAL_RESULTS)}
          className="text-xs text-primary-400 hover:text-primary-300"
        >
          Finalize Results &rarr;
        </Button>
      </div>
    </div>
  );
}
