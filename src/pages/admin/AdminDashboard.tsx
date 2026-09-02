import { motion } from 'framer-motion';
import {
  Users,
  FolderOpen,
  Vote,
  TrendingUp,
  Trophy,
  Clock,
  BarChart3,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LiveBadge from '../../components/ui/LiveBadge';
import { useAdmin } from '../../hooks/useAdmin';
import { formatTimeAgo, getLocalStorage } from '../../lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

export default function AdminDashboard() {
  const { stats, settings, recentActions } = useAdmin();

  const statItems = [
    { label: 'Total Registered Students', value: stats.totalStudents.toString(), icon: Users, color: 'text-primary-400', bgColor: 'bg-primary-500/10' },
    { label: 'Active Voters', value: stats.totalParticipants.toString(), icon: Vote, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { label: 'Award Categories', value: stats.totalCategories.toString(), icon: FolderOpen, color: 'text-gold-400', bgColor: 'bg-gold-500/10' },
    { label: 'Total Ballots Cast', value: stats.totalVotes.toString(), icon: BarChart3, color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
  ];

  const turnout = stats.participationRate || 0;
  const remainingStudents = Math.max(0, stats.totalStudents - stats.totalParticipants);

  // Compute actual leading candidate from local votes
  const localTotals = getLocalStorage<Record<string, Record<string, number>>>('td_category_vote_totals', {});
  const teacherVoteSums: Record<string, number> = {};
  Object.values(localTotals).forEach((catMap) => {
    Object.entries(catMap).forEach(([tId, count]) => {
      teacherVoteSums[tId] = (teacherVoteSums[tId] || 0) + count;
    });
  });

  const hasAnyVotes = stats.totalVotes > 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="section-subtitle">Real-time overview of Teachers' Day Awards 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={settings?.is_voting_open ? 'success' : 'danger'}
            icon={<span className={`flex h-2 w-2 rounded-full ${settings?.is_voting_open ? 'bg-emerald-500' : 'bg-rose-500'}`} />}
          >
            {settings?.is_voting_open ? 'Voting Open' : 'Voting Closed'}
          </Badge>
          <LiveBadge />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
        initial="hidden"
        animate="visible"
      >
        {statItems.map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeUp}>
            <Card className="relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-label">{stat.label}</p>
                  <p className="stat-value mt-1">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon size={18} className={stat.color} />
                </div>
              </div>
              {/* Decorative gradient */}
              <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full ${stat.bgColor} opacity-30 blur-2xl`} />
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Participation Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Student Turnout</h2>
              <Badge variant="primary">
                <TrendingUp size={12} />
                {turnout}%
              </Badge>
            </div>

            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg viewBox="0 0 100 100" className="-rotate-90">
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-surface-700"
                />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="url(#dashGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${turnout * 2.64} ${100 * 2.64}`}
                />
                <defs>
                  <linearGradient id="dashGradient">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{turnout}%</span>
                <span className="text-[10px] text-surface-400">turnout</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div>
                <p className="text-surface-400">Voted</p>
                <p className="text-white font-semibold">{stats.totalParticipants}</p>
              </div>
              <div>
                <p className="text-surface-400">Remaining</p>
                <p className="text-white font-semibold">{remainingStudents}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Recent Admin Audit Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Admin Audit Log</h2>
              <Clock size={14} className="text-surface-500" />
            </div>
            {recentActions.length === 0 ? (
              <p className="text-xs text-surface-400 py-6 text-center italic">
                No recent administrative actions recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActions.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-primary-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-200 leading-relaxed font-medium">
                        {activity.action}
                      </p>
                      <p className="text-[10px] text-surface-500 mt-0.5">
                        {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Current Leader Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Trophy className="text-gold-400" size={16} />
              Leaderboard Standings
            </h2>
            <Badge variant="gold">{hasAnyVotes ? 'Live Tallies' : 'Awaiting Votes'}</Badge>
          </div>
          {!hasAnyVotes ? (
            <p className="text-xs text-surface-400 py-4 text-center">
              No votes cast in any category yet. Ballots will appear here as soon as voting starts.
            </p>
          ) : (
            <p className="text-xs text-surface-300">
              Total {stats.totalVotes} votes cast across categories.
            </p>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
