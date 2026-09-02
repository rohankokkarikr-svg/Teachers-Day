import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Activity, Users, Radio, RefreshCw } from 'lucide-react';
import Card from '../../components/ui/Card';
import LiveBadge from '../../components/ui/LiveBadge';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import Leaderboard from '../../components/results/Leaderboard';
import { useCategories } from '../../hooks/useCategories';
import { useRealtime } from '../../hooks/useRealtime';

export default function LiveResultsPage() {
  const { categories, isLoading: loadingCategories } = useCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Default to first category if none selected
  const activeCategoryId = selectedCategoryId || categories[0]?.id || '';

  const {
    leaderboard,
    showLiveCounts,
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

  return (
    <div className="page-container max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="section-title flex items-center gap-2">
              <Trophy className="text-gold-400" size={24} />
              Live Results
            </h1>
            <LiveBadge />
          </div>
          <p className="section-subtitle">Real-time leaderboard updates across award categories</p>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="btn-icon p-2 rounded-xl text-surface-400 hover:text-white bg-surface-800/60 border border-surface-700/50"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </motion.div>

      {/* Category Selection Tabs */}
      {loadingCategories ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 -mx-4 px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="button" className="!w-32 flex-shrink-0" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 -mx-4 px-4">
          {categories.map((cat) => {
            const isSelected = cat.id === activeCategoryId;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap tap-target flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary-500/25 text-white border border-primary-500/40 font-semibold shadow-glow-primary'
                    : 'bg-surface-800/60 text-surface-400 border border-surface-700/50 hover:text-white hover:bg-surface-700/60'
                }`}
              >
                <span>{cat.icon || '🏆'}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass-card border-rose-500/30 p-4 text-center text-rose-400 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Leaderboard */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : (
        <Leaderboard entries={leaderboard} showLiveCounts={showLiveCounts} />
      )}

      {/* Real-time Dynamic Stats Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5"
      >
        {/* Card 1: Total Category Votes */}
        <Card variant="flat" padding="md" className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="stat-label text-xs flex items-center gap-1.5 text-surface-400">
              <Activity size={14} className="text-primary-400" />
              Category Votes
            </p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Live
            </span>
          </div>
          <motion.p
            key={totalVotesCast}
            initial={{ scale: 1.15, color: '#818cf8' }}
            animate={{ scale: 1, color: '#ffffff' }}
            transition={{ duration: 0.3 }}
            className="stat-value text-2xl font-bold text-white tracking-tight"
          >
            {totalVotesCast.toLocaleString()}
          </motion.p>
          <p className="text-[11px] text-surface-400 mt-1">
            Across {leaderboard.length} candidates
          </p>
        </Card>

        {/* Card 2: Candidate Leading Share */}
        <Card variant="flat" padding="md" className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="stat-label text-xs flex items-center gap-1.5 text-surface-400">
              <Users size={14} className="text-gold-400" />
              Leading Nominee
            </p>
            <span className="text-[10px] text-gold-400 font-semibold">
              {hasVotes ? `${leadingShare}% Share` : '0%'}
            </span>
          </div>
          <p className="stat-value text-xl font-bold text-white truncate">
            {hasVotes ? leadingTeacher?.teacher_name : 'No votes yet'}
          </p>
          <p className="text-[11px] text-surface-400 mt-1 truncate">
            {hasVotes
              ? `${leadingTeacher?.total_votes} votes (${leadingTeacher?.teacher_department})`
              : 'Awaiting first student vote'}
          </p>
        </Card>

        {/* Card 3: Real-Time Stream Status */}
        <Card variant="flat" padding="md" className="relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="stat-label text-xs flex items-center gap-1.5 text-surface-400">
              <Radio size={14} className="text-emerald-400" />
              Feed Status
            </p>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <p className="stat-value text-xl font-bold text-emerald-400 flex items-center gap-2">
            <span>{isLiveConnected ? 'Realtime WebSocket' : 'Live Sync'}</span>
          </p>
          <p className="text-[11px] text-surface-400 mt-1">
            Active auto-syncing
          </p>
        </Card>
      </motion.div>

      <div className="h-8" />
    </div>
  );
}
