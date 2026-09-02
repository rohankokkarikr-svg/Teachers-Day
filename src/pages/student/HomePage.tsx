import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, ArrowRight, Star, Heart, Sparkles, Trophy, Lock } from 'lucide-react';
import { APP_YEAR, ROUTES } from '../../lib/constants';
import Button from '../../components/ui/Button';
import ParticleBackground from '../../components/ui/ParticleBackground';
import { useAuth } from '../../hooks/useAuth';
import { getLocalStorage } from '../../lib/utils';
import type { VotingSettings } from '../../types';

const HERO_BANNER_URL = 'https://i.pinimg.com/736x/6a/57/c1/6a57c14e64230787ec342b6cbbb2b73e.jpg';

const features = [
  {
    icon: <Star className="text-gold-400" size={22} />,
    title: 'Vote for Your Teachers',
    description: 'Distribute 5 votes across your favourite teachers in each award category.',
  },
  {
    icon: <Trophy className="text-primary-400" size={22} />,
    title: 'Live Results',
    description: 'Watch the leaderboard update in real-time as votes pour in.',
  },
  {
    icon: <Heart className="text-rose-400" size={22} />,
    title: 'Share Appreciation',
    description: 'Leave heartfelt messages on the appreciation wall for your mentors.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: 'easeOut' as const },
  }),
};

export default function HomePage() {
  const { isAuthenticated } = useAuth();
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

  return (
    <div className="min-h-[100dvh] relative overflow-hidden">
      <ParticleBackground count={25} />

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] px-4 text-center">
        {/* Background ambient lighting from banner */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 blur-3xl scale-110"
          style={{
            backgroundImage: `url(${HERO_BANNER_URL})`,
            backgroundPosition: 'center top',
            backgroundSize: 'cover',
          }}
        />

        {/* Background gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.25) 0%, transparent 70%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(245, 158, 11, 0.12) 0%, transparent 60%)',
          }}
        />

        <div className="max-w-4xl mx-auto pt-20 pb-10 relative z-10">
          {/* Badge */}
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-md mb-6 shadow-sm"
          >
            <Sparkles size={14} className="text-gold-400" />
            <span className="text-xs font-semibold text-surface-200 tracking-wider uppercase">
              Teachers' Day Celebration {APP_YEAR}
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.15] mb-4 text-balance"
          >
            Celebrate the{' '}
            <span className="text-gradient-primary">Mentors</span>{' '}
            Who Shape{' '}
            <span className="text-gradient-gold">Our Future</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            custom={2}
            variants={fadeUp}
            className="text-surface-300 text-sm sm:text-base md:text-lg max-w-xl mx-auto mb-6 text-balance"
          >
            {isVotingOpen
              ? 'Cast your votes, celebrate teaching excellence, and honor the educators who inspire us every day.'
              : 'Voting has officially concluded. Explore the final live leaderboard and celebratory appreciation messages.'}
          </motion.p>

          {/* Hero Banner Showcase Frame */}
          <motion.div
            custom={3}
            variants={fadeUp}
            className="relative max-w-3xl mx-auto my-6 rounded-2xl md:rounded-3xl overflow-hidden p-1.5 bg-gradient-to-b from-white/20 via-white/5 to-transparent border border-white/10 shadow-2xl shadow-indigo-950/60 group"
          >
            <div className="relative rounded-xl md:rounded-2xl overflow-hidden bg-surface-900">
              <img
                src={HERO_BANNER_URL}
                alt="Teachers' Day Celebration Banner"
                loading="eager"
                className="w-full h-48 sm:h-64 md:h-80 object-cover object-center transform transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950/80 via-transparent to-transparent pointer-events-none" />
              
              {/* Floating Overlay Badge on Banner */}
              <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 px-3 py-1.5 rounded-xl bg-surface-950/70 backdrop-blur-md border border-white/15 flex items-center gap-2">
                <Sparkles size={14} className="text-gold-400 animate-pulse" />
                <span className="text-xs font-semibold text-white">
                  Happy Teachers' Day {APP_YEAR}
                </span>
              </div>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            custom={4}
            variants={fadeUp}
            className="flex flex-col xs:flex-row items-center justify-center gap-3.5 mt-6"
          >
            {isVotingOpen ? (
              <>
                <Link to={isAuthenticated ? ROUTES.VOTE : ROUTES.LOGIN}>
                  <Button
                    variant="primary"
                    size="lg"
                    iconRight={<ArrowRight size={18} />}
                    className="w-full xs:w-auto shadow-glow-primary"
                  >
                    {isAuthenticated ? 'Continue Voting' : 'Start Voting Now'}
                  </Button>
                </Link>
                <Link to={ROUTES.LIVE_RESULTS}>
                  <Button
                    variant="outline"
                    size="lg"
                    icon={<Trophy size={16} className="text-gold-400" />}
                    className="w-full xs:w-auto"
                  >
                    View Live Results
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to={ROUTES.LIVE_RESULTS}>
                  <Button
                    variant="gold"
                    size="lg"
                    icon={<Trophy size={18} />}
                    className="w-full xs:w-auto shadow-glow-gold"
                  >
                    View Final Results
                  </Button>
                </Link>
                <Link to={ROUTES.VOTE}>
                  <Button
                    variant="outline"
                    size="lg"
                    icon={<Lock size={16} className="text-rose-400" />}
                    className="w-full xs:w-auto"
                  >
                    Browse Categories (Closed)
                  </Button>
                </Link>
              </>
            )}
          </motion.div>

          {/* Trophy decoration */}
          <motion.div
            custom={5}
            variants={fadeUp}
            className="mt-8 flex items-center justify-center gap-6 text-surface-600"
          >
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-surface-700" />
            <Award size={28} className="text-gold-500/40 animate-float" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-surface-700" />
          </motion.div>
        </div>

        {/* Feature Cards */}
        <motion.div
          className="relative w-full max-w-4xl mx-auto mt-4 mb-16 grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 z-10"
          initial="hidden"
          animate="visible"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i + 6}
              variants={fadeUp}
              className="glass-card-hover p-5 text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-white/[0.05] flex items-center justify-center mx-auto mb-3">
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-surface-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
