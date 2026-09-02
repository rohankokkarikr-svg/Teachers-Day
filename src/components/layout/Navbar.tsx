import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Menu, X, LogOut, Shield } from 'lucide-react';
import { APP_NAME, APP_YEAR, ROUTES } from '../../lib/constants';
import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

interface NavbarProps {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  userName?: string;
  onLogout?: () => void;
}

export default function Navbar(props: NavbarProps) {
  const auth = useAuth();
  const isAuthenticated = props.isAuthenticated ?? auth.isAuthenticated;
  const isAdmin = props.isAdmin ?? auth.isAdmin;
  const userName = props.userName ?? auth.profile?.full_name ?? auth.user?.email ?? 'Student';
  const handleLogout = props.onLogout ?? auth.signOut;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: 'Vote', path: ROUTES.VOTE },
    { label: 'Results', path: ROUTES.LIVE_RESULTS },
    { label: 'Wall', path: ROUTES.APPRECIATION },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 border-b border-white/[0.06]"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-xl" />
      <div className="relative max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          to={ROUTES.HOME}
          className="flex items-center gap-2.5 group"
          aria-label={`${APP_NAME} ${APP_YEAR} - Home`}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-primary group-hover:shadow-lg transition-shadow">
            <Award size={18} className="text-white" />
          </div>
          <div className="flex items-center">
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
              {APP_NAME}
            </span>
            <span className="text-[10px] text-gold-400 font-semibold ml-1.5">
              {APP_YEAR}
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        {isAuthenticated && (
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.path)
                    ? 'text-white bg-white/[0.08]'
                    : 'text-surface-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link to={ROUTES.ADMIN}>
                  <Button variant="outline" size="sm" icon={<Shield size={14} />}>
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <div className="hidden md:flex items-center gap-3">
                <span className="text-sm text-surface-400">
                  {userName}
                </span>
                <button
                  onClick={handleLogout}
                  className="btn-icon rounded-lg"
                  aria-label="Log out"
                >
                  <LogOut size={16} />
                </button>
              </div>
              {/* Mobile menu toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden btn-icon rounded-lg"
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          ) : (
            <Link to={ROUTES.LOGIN}>
              <Button variant="primary" size="sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden relative border-t border-white/[0.06] overflow-hidden"
          >
            <div className="absolute inset-0 bg-surface-950/95 backdrop-blur-xl" />
            <div className="relative px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'text-white bg-white/[0.08]'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="divider !my-2" />
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-surface-400">{userName}</span>
                <button
                  onClick={() => {
                    handleLogout?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-sm text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1.5"
                >
                  <LogOut size={14} />
                  Log Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
