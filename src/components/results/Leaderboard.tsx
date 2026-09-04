import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { MEDAL_EMOJIS } from '../../lib/constants';
import type { LeaderboardEntry } from '../../types';
import Card from '../ui/Card';
import TeacherAvatar from '../ui/TeacherAvatar';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  showLiveCounts?: boolean;
}

export default function Leaderboard({ entries, showLiveCounts = true }: LeaderboardProps) {
  const maxVotes = entries[0]?.total_votes || 1;
  const totalVotes = entries.reduce((sum, item) => sum + item.total_votes, 0);

  if (entries.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-surface-400 text-sm">
        No votes recorded in this category yet.
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="space-y-3">
        <AnimatePresence>
          {entries.map((entry, index) => {
            const barWidth = maxVotes > 0 ? (entry.total_votes / maxVotes) * 100 : 0;
            const votePercent = totalVotes > 0 ? Math.round((entry.total_votes / totalVotes) * 100) : 0;
            const isTop3 = index < 3;
            const isWinner = index === 0;

            return (
              <motion.div
                key={entry.teacher_id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  layout: { type: 'spring', stiffness: 350, damping: 25 },
                  opacity: { duration: 0.2 },
                }}
              >
                <Card
                  variant={isWinner ? 'default' : isTop3 ? 'default' : 'flat'}
                  padding="none"
                  className={`${
                    isWinner
                      ? 'ring-1 ring-gold-500/40 bg-gradient-to-r from-gold-500/10 via-surface-900 to-surface-900'
                      : isTop3
                      ? 'ring-1 ring-white/[0.08]'
                      : ''
                  } transition-all duration-300`}
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Rank */}
                    <div className="w-8 text-center flex-shrink-0">
                      {isTop3 ? (
                        <span className="text-xl">{MEDAL_EMOJIS[index]}</span>
                      ) : (
                        <span className="text-sm font-bold text-surface-500">
                          #{index + 1}
                        </span>
                      )}
                    </div>

                    {/* Avatar / Photo */}
                    <TeacherAvatar
                      name={entry.teacher_name}
                      photoUrl={entry.teacher_photo}
                      size="md"
                      rounded="xl"
                      className="shadow-sm"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {entry.teacher_name}
                        </h3>
                        {isWinner && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gold-500/20 text-gold-400 border border-gold-500/30">
                            Leading
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-surface-400">{entry.teacher_department}</p>

                      {/* Vote Bar */}
                      {showLiveCounts && (
                        <div className="mt-2 h-1.5 rounded-full bg-surface-700/50 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              index === 0
                                ? 'bg-gradient-to-r from-gold-500 to-gold-400 shadow-glow-gold'
                                : index === 1
                                ? 'bg-gradient-to-r from-surface-300 to-surface-400'
                                : index === 2
                                ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                                : 'bg-gradient-to-r from-primary-600 to-primary-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Vote Count & Percentage */}
                    <div className="text-right flex-shrink-0">
                      {showLiveCounts ? (
                        <div>
                          <motion.p
                            key={entry.total_votes}
                            initial={{ scale: 1.25, color: '#fbbf24' }}
                            animate={{ scale: 1, color: isWinner ? '#fbbf24' : isTop3 ? '#ffffff' : '#cbd5e1' }}
                            transition={{ duration: 0.3 }}
                            className={`text-lg font-bold tabular-nums ${
                              isWinner ? 'text-gold-400' : isTop3 ? 'text-white' : 'text-surface-300'
                            }`}
                          >
                            {entry.total_votes}
                          </motion.p>
                          <p className="text-[10px] text-surface-400 font-medium">
                            {votePercent}%
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-surface-500 italic">Hidden</span>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
