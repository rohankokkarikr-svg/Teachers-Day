import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CATEGORY_ICONS } from '../../lib/constants';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { getLocalStorage } from '../../lib/utils';
import type { VotingSettings } from '../../types';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

export default function VotePage() {
  const { user } = useAuth();
  const { categories, isLoading, error } = useCategories(user?.id);
  const [isVotingOpen, setIsVotingOpen] = useState<boolean>(() => {
    const s = getLocalStorage<VotingSettings | null>('td_admin_settings', null);
    return s ? s.is_voting_open : true;
  });

  useEffect(() => {
    const checkSettings = () => {
      const s = getLocalStorage<VotingSettings | null>('td_admin_settings', null);
      if (s) setIsVotingOpen(s.is_voting_open);
    };

    window.addEventListener('td_admin_settings_updated', checkSettings);
    window.addEventListener('storage', checkSettings);

    return () => {
      window.removeEventListener('td_admin_settings_updated', checkSettings);
      window.removeEventListener('storage', checkSettings);
    };
  }, []);

  const votedCount = categories.filter((c) => c.voted).length;
  const totalCount = categories.length;

  return (
    <div className="page-container max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="section-title">Award Categories</h1>
        <p className="section-subtitle">
          Vote in each category — distribute 5 votes per category
        </p>

        {/* Voting Closed Banner if admin locked it */}
        {!isVotingOpen && (
          <div className="mt-4 glass-card border-rose-500/30 bg-rose-500/10 p-4 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="text-rose-400 flex-shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-white">Voting is currently closed</p>
              <p className="text-xs text-surface-300">
                The administrator has paused voting submissions. You can browse categories and check back when voting re-opens.
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="mt-4 glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-surface-300">Your Progress</span>
            <span className="text-sm font-semibold text-white">
              {votedCount} / {totalCount} completed
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--gradient-primary)' }}
              initial={{ width: 0 }}
              animate={{ width: `${totalCount > 0 ? (votedCount / totalCount) * 100 : 0}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Error state */}
      {error && (
        <div className="glass-card border-rose-500/30 p-4 text-center text-rose-400 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : (
        /* Category Cards */
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
        >
          {categories.map((category, i) => (
            <motion.div key={category.id} custom={i} variants={fadeUp}>
              <Link to={`/vote/${category.id}`}>
                <Card variant="hover" padding="none">
                  <div className="flex items-center gap-4 p-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0 text-2xl">
                      {CATEGORY_ICONS[category.name] || category.icon || '🏆'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {category.name}
                        </h3>
                        {category.voted && (
                          <Badge variant="success" icon={<CheckCircle2 size={12} />}>
                            Voted
                          </Badge>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-xs text-surface-400 line-clamp-1">
                          {category.description}
                        </p>
                      )}
                      <p className="text-[10px] text-surface-500 mt-1">
                        {category.teacherCount} teachers
                      </p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={18} className="text-surface-600 flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Bottom spacing for mobile nav */}
      <div className="h-8" />
    </div>
  );
}
