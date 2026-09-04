import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, User, ArrowRight, Shield, Lock, CheckCircle2, Smartphone, ShieldAlert } from 'lucide-react';
import { APP_NAME, APP_YEAR, ROUTES } from '../../lib/constants';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ParticleBackground from '../../components/ui/ParticleBackground';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { getDeviceBoundStudent } from '../../lib/deviceId';

export default function LoginPage() {
  const boundStudent = getDeviceBoundStudent();
  const [fullName, setFullName] = useState(() => boundStudent?.name || '');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { signInWithName, signIn, isAuthenticated, isAdmin, profile, user } = useAuth();
  const navigate = useNavigate();

  // Pre-fill bound student name if present
  useEffect(() => {
    if (boundStudent?.name && !fullName) {
      setFullName(boundStudent.name);
    }
  }, [boundStudent]);

  // If already logged in, redirect automatically to Vote page (or Admin)
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isAdmin ? ROUTES.ADMIN : ROUTES.VOTE, { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = fullName.trim();
    if (!cleanName) {
      setError('Please enter your full name');
      return;
    }

    if (cleanName.length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithName(cleanName);
      if (result.success) {
        toast.success(`Welcome, ${cleanName}!`, 'You can now cast your votes.');
        navigate(ROUTES.VOTE);
      } else {
        setError(result.error || 'Failed to sign in. Please try again.');
        toast.error('Access Restricted', result.error || 'Could not sign in with this account.');
      }
    } catch {
      toast.error('Authentication Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!adminPassword) {
      setError('Please enter the admin passcode');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn('admin@college.edu', adminPassword);
      if (result.success) {
        toast.success('Admin Authenticated!', 'Welcome to Admin Dashboard.');
        navigate(ROUTES.ADMIN);
      } else {
        setError(result.error || 'Invalid admin credentials.');
        toast.error('Admin Auth Failed', result.error || 'Invalid credentials.');
      }
    } catch {
      toast.error('Error', 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // If already logged in, show authenticated quick-action card
  if (isAuthenticated) {
    const displayName = profile?.full_name || user?.email || 'Student';
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-8 relative">
        <ParticleBackground count={15} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-sm glass-card p-8 text-center space-y-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-glow-primary">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-white mb-1">
              Already Signed In
            </h2>
            <p className="text-surface-400 text-sm">
              Logged in as <span className="text-white font-medium">{displayName}</span>
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(isAdmin ? ROUTES.ADMIN : ROUTES.VOTE)}
              iconRight={<ArrowRight size={16} />}
            >
              {isAdmin ? 'Go to Admin Dashboard' : 'Continue to Voting'}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-8 relative">
      <ParticleBackground count={15} />

      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(99, 102, 241, 0.1) 0%, transparent 60%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to={ROUTES.HOME} className="inline-block">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
              <Award size={28} className="text-white" />
            </div>
          </Link>
          <h1 className="font-display text-2xl font-bold text-white">
            {isAdminMode ? 'Admin Access' : 'Enter Your Name'}
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            {isAdminMode
              ? 'Sign in with administrator credentials'
              : `Welcome to ${APP_NAME} ${APP_YEAR}`}
          </p>
        </div>

        {/* Form */}
        {!isAdminMode ? (
          /* Name Only Student Form */
          <form onSubmit={handleStudentSubmit} className="glass-card p-6 space-y-5">
            {boundStudent?.name && (
              <div className="bg-primary-500/10 border border-primary-500/25 rounded-xl p-3 text-xs flex items-start gap-2.5">
                <Smartphone size={16} className="text-primary-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Device Registered: {boundStudent.name}</p>
                  <p className="text-[11px] text-surface-400 mt-0.5">Only 1 account per device is permitted to maintain voting fairness.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2.5">
                <ShieldAlert size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            <Input
              label="Your Full Name"
              placeholder="e.g. Rahul Sharma"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setError('');
              }}
              icon={<User size={18} />}
              autoComplete="name"
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              size="lg"
              iconRight={!isLoading ? <ArrowRight size={16} /> : undefined}
            >
              Start Voting
            </Button>
          </form>
        ) : (
          /* Admin Passcode Form */
          <form onSubmit={handleAdminSubmit} className="glass-card p-6 space-y-4">
            <Input
              label="Admin Passcode"
              type="password"
              placeholder="••••••••"
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setError('');
              }}
              icon={<Lock size={16} />}
              autoComplete="current-password"
              autoFocus
            />

            {error && (
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2.5">
                <ShieldAlert size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="gold"
              fullWidth
              isLoading={isLoading}
              size="lg"
              iconRight={<Shield size={16} />}
            >
              Admin Sign In
            </Button>
          </form>
        )}

        {/* Toggle Student / Admin */}
        <p className="text-center text-xs text-surface-400 mt-6">
          {!isAdminMode ? (
            <button
              onClick={() => {
                setIsAdminMode(true);
                setError('');
              }}
              className="text-surface-400 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              <Shield size={12} />
              Admin Portal Login
            </button>
          ) : (
            <button
              onClick={() => {
                setIsAdminMode(false);
                setError('');
              }}
              className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
            >
              ← Back to Student Name Login
            </button>
          )}
        </p>
      </motion.div>
    </div>
  );
}
