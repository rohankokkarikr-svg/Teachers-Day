import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronLeft, ChevronRight, X, Sparkles, Award, Star } from 'lucide-react';
import { APP_NAME, APP_YEAR, ROUTES } from '../lib/constants';
import TeacherAvatar from '../components/ui/TeacherAvatar';
import { useCategories } from '../hooks/useCategories';
import { useRealtime } from '../hooks/useRealtime';

type EventStage = 'category-intro' | 'winner' | 'all-completed';

export default function EventModePage() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [stage, setStage] = useState<EventStage>('category-intro');

  const currentCategory = categories[activeCategoryIndex];
  const { leaderboard } = useRealtime(currentCategory?.id);

  // The First Winner (Champion)
  const winner = leaderboard[0];

  const handleNextStage = useCallback(() => {
    if (stage === 'category-intro') {
      setStage('winner');
    } else if (stage === 'winner') {
      if (activeCategoryIndex < categories.length - 1) {
        setActiveCategoryIndex((prev) => prev + 1);
        setStage('category-intro');
      } else {
        setStage('all-completed');
      }
    } else if (stage === 'all-completed') {
      navigate(ROUTES.ADMIN);
    }
  }, [stage, activeCategoryIndex, categories.length, navigate]);

  const handlePrevStage = useCallback(() => {
    if (stage === 'all-completed') {
      setStage('winner');
    } else if (stage === 'winner') {
      setStage('category-intro');
    } else if (stage === 'category-intro' && activeCategoryIndex > 0) {
      setActiveCategoryIndex((prev) => prev - 1);
      setStage('winner');
    }
  }, [stage, activeCategoryIndex]);

  // Keyboard navigation for presentation control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNextStage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStage();
      } else if (e.key === 'Escape') {
        navigate(ROUTES.ADMIN);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStage, handlePrevStage, navigate]);

  return (
    <div className="event-mode select-none flex flex-col justify-between p-6 sm:p-10 text-white min-h-[100dvh] relative overflow-hidden bg-surface-950">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-indigo-950/30 to-surface-950" />

      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold-400 via-gold-500 to-amber-600 flex items-center justify-center text-surface-950 font-bold shadow-glow-gold">
            <Trophy size={26} />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              {APP_NAME} {APP_YEAR}
            </h1>
            <p className="text-xs text-gold-400 font-semibold tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles size={12} className="animate-pulse" /> Winner Announcement Ceremony
            </p>
          </div>
        </div>

        {/* Category Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevStage}
              className="w-10 h-10 rounded-full border border-surface-700/80 bg-surface-900/90 text-surface-300 hover:text-white flex items-center justify-center transition-all hover:scale-105"
              title="Previous (Left Arrow)"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNextStage}
              className="btn-gold rounded-full px-6 py-2.5 text-xs font-bold tracking-wider uppercase flex items-center gap-2 shadow-glow-gold hover:scale-105 transition-all"
              title="Next (Spacebar / Right Arrow)"
            >
              {stage === 'category-intro' ? 'Reveal Winner' : stage === 'winner' ? 'Next Award' : 'Finish'}
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => navigate(ROUTES.ADMIN)}
            className="w-10 h-10 rounded-full border border-surface-700/80 bg-surface-900/90 text-surface-400 hover:text-rose-400 flex items-center justify-center transition-all"
            title="Exit Event Mode (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Showcase */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-6 z-10 relative">
        <AnimatePresence mode="wait">
          {/* STAGE 1: Category Intro */}
          {stage === 'category-intro' && (
            <motion.div
              key={`intro-${currentCategory?.id || activeCategoryIndex}`}
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1, y: -30 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="space-y-6 max-w-3xl px-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                className="w-24 h-24 rounded-3xl bg-surface-900/80 border border-gold-500/30 flex items-center justify-center text-5xl mx-auto shadow-2xl backdrop-blur-md"
              >
                {currentCategory?.icon || '🏆'}
              </motion.div>

              <div className="space-y-3">
                <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  Award Category {activeCategoryIndex + 1} of {categories.length}
                </span>

                <h2 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gold-200 to-gold-400 leading-tight">
                  {currentCategory?.name}
                </h2>

                {currentCategory?.description && (
                  <p className="text-base sm:text-xl text-surface-300 max-w-xl mx-auto leading-relaxed">
                    {currentCategory.description}
                  </p>
                )}
              </div>

              <div className="pt-6">
                <button
                  onClick={handleNextStage}
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-gold-500 to-amber-500 text-surface-950 font-bold text-base shadow-glow-gold hover:scale-105 transition-all cursor-pointer"
                >
                  <Trophy size={20} />
                  <span>Reveal 1st Place Winner</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 2: 1ST PLACE WINNER SHOWCASE */}
          {stage === 'winner' && (
            <motion.div
              key={`winner-${currentCategory?.id || activeCategoryIndex}`}
              initial={{ opacity: 0, scale: 0.75, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="w-full max-w-2xl mx-auto px-4"
            >
              {/* Category Tag */}
              <div className="mb-4">
                <span className="px-4 py-1 rounded-full text-xs font-semibold text-gold-300 bg-gold-500/15 border border-gold-500/30 inline-flex items-center gap-1.5">
                  <Star size={12} className="text-gold-400" />
                  {currentCategory?.name}
                </span>
              </div>

              {winner ? (
                <div className="glass-card p-8 sm:p-12 text-center border-2 border-gold-400/60 bg-gradient-to-b from-gold-500/20 via-surface-900/90 to-surface-950/90 shadow-2xl shadow-amber-500/25 relative overflow-hidden rounded-3xl">
                  {/* Floating celebratory sparkles */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                    <Sparkles size={180} className="text-gold-400 animate-spin" style={{ animationDuration: '20s' }} />
                  </div>

                  {/* Golden Trophy Banner */}
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center justify-center gap-2 mb-6"
                  >
                    <span className="text-4xl animate-bounce">🏆</span>
                    <span className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-widest uppercase bg-gradient-to-r from-gold-400 to-amber-500 text-surface-950 shadow-md">
                      1ST PLACE WINNER
                    </span>
                    <span className="text-4xl animate-bounce">🏆</span>
                  </motion.div>

                  {/* Winner Photo or Large Avatar */}
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                    className="relative w-36 h-36 sm:w-44 sm:h-44 mx-auto mb-6 rounded-3xl p-1.5 bg-gradient-to-b from-gold-300 via-amber-500 to-gold-600 shadow-glow-gold"
                  >
                    <TeacherAvatar
                      name={winner.teacher_name}
                      photoUrl={winner.teacher_photo}
                      size="2xl"
                      rounded="2xl"
                      className="!w-full !h-full shadow-inner"
                    />
                  </motion.div>

                  {/* Winner Name & Department */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-2 mb-6"
                  >
                    <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                      {winner.teacher_name}
                    </h2>
                    <p className="text-base sm:text-xl text-gold-300 font-semibold">
                      {winner.teacher_department}
                    </p>
                  </motion.div>

                  {/* Votes Ribbon */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-surface-900/90 border border-gold-500/40 text-gold-400 font-bold text-lg sm:text-2xl shadow-inner"
                  >
                    <Award size={24} className="text-gold-400" />
                    <span>{winner.total_votes} Total Votes</span>
                  </motion.div>
                </div>
              ) : (
                <div className="glass-card p-12 text-center border-surface-700 rounded-3xl">
                  <p className="text-lg font-semibold text-surface-300 mb-2">No Votes Recorded Yet</p>
                  <p className="text-xs text-surface-500">No candidate votes were cast in this category.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* STAGE 3: ALL CATEGORIES COMPLETED FINALE */}
          {stage === 'all-completed' && (
            <motion.div
              key="finale"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="space-y-6 max-w-3xl px-4"
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center text-5xl mx-auto shadow-glow-gold">
                🎉
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-4xl sm:text-6xl font-extrabold text-gradient-gold">
                  Congratulations to All Winners!
                </h2>
                <p className="text-base sm:text-xl text-surface-300 max-w-xl mx-auto">
                  All category awards have been successfully announced. Happy Teachers' Day to all our extraordinary educators!
                </p>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => navigate(ROUTES.ADMIN)}
                  className="btn-gold rounded-full px-8 py-3 text-sm font-bold tracking-wider uppercase shadow-glow-gold"
                >
                  Return to Admin Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-surface-400 z-10 pt-4 border-t border-white/[0.08]">
        <div>
          Award Category {activeCategoryIndex + 1} of {categories.length}
        </div>

        {/* Category Dot Steppers */}
        <div className="flex items-center gap-2">
          {categories.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveCategoryIndex(idx);
                setStage('category-intro');
              }}
              title={c.name}
              className={`h-2.5 rounded-full transition-all ${
                idx === activeCategoryIndex
                  ? 'bg-gold-400 w-8 shadow-glow-gold'
                  : 'bg-surface-700 hover:bg-surface-500 w-2.5'
              }`}
            />
          ))}
        </div>

        <div className="text-[11px] text-surface-400">
          Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 text-white">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-surface-800 border border-surface-700 text-white">→</kbd> to Advance
        </div>
      </div>
    </div>
  );
}
