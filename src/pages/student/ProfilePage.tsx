import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, CheckCircle2, LogOut, Shield } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { ROUTES } from '../../lib/constants';

export default function ProfilePage() {
  const { user, profile, role, isAdmin, signOut } = useAuth();
  const { categories } = useCategories(user?.id);
  const navigate = useNavigate();

  const votedCategories = categories.filter((c) => c.voted).length;
  const totalCategories = categories.length;

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Student Voter';
  const displayEmail = profile?.email || user?.email || 'student@college.edu';
  const joinedAt = profile?.created_at || new Date().toISOString();

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="page-container max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        {/* Avatar */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
          <User size={36} className="text-white" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          {displayName}
        </h1>
        <p className="text-sm text-surface-400 flex items-center justify-center gap-1.5 mt-1">
          <Mail size={14} />
          {displayEmail}
        </p>
        <div className="mt-2">
          <Badge
            variant={isAdmin ? 'gold' : 'primary'}
            icon={isAdmin ? <Shield size={10} /> : undefined}
          >
            {isAdmin ? 'Administrator' : 'Student'}
          </Badge>
        </div>
      </motion.div>

      {/* Voting Progress */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Voting Progress</h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-surface-400">Categories Voted</span>
            <span className="text-sm font-semibold text-white">
              {votedCategories} / {totalCategories}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--gradient-primary)' }}
              initial={{ width: 0 }}
              animate={{
                width: `${totalCategories > 0 ? (votedCategories / totalCategories) * 100 : 0}%`,
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-4 space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between text-xs">
                <span className="text-surface-300 truncate max-w-[200px]">
                  {cat.icon || '🏆'} {cat.name}
                </span>
                {cat.voted ? (
                  <Badge variant="success" icon={<CheckCircle2 size={10} />}>
                    Voted
                  </Badge>
                ) : (
                  <Badge variant="neutral">Pending</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Account Info */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Account</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-400">Member Since</span>
              <span className="text-surface-200">
                {new Date(joinedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Role</span>
              <span className="text-surface-200 capitalize">{role}</span>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Logout */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          variant="danger"
          fullWidth
          icon={<LogOut size={16} />}
          onClick={handleSignOut}
        >
          Sign Out
        </Button>
      </motion.div>

      <div className="h-8" />
    </div>
  );
}
