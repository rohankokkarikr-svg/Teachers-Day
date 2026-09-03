import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  GraduationCap,
  FolderOpen,
  Vote,
  BarChart3,
  Users,
  MessageSquareHeart,
  Trophy,
  Presentation,
  Settings,
  Award,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Menu,
} from 'lucide-react';
import { APP_NAME, APP_YEAR, ROUTES } from '../../lib/constants';
import { useAuth } from '../../hooks/useAuth';

const adminNavItems = [
  { label: 'Dashboard', path: ROUTES.ADMIN_DASHBOARD, Icon: LayoutDashboard, exact: true },
  { label: 'Teachers', path: ROUTES.ADMIN_TEACHERS, Icon: GraduationCap },
  { label: 'Categories', path: ROUTES.ADMIN_CATEGORIES, Icon: FolderOpen },
  { label: 'Voting Control', path: ROUTES.ADMIN_VOTING, Icon: Vote },
  { label: 'Live Results', path: ROUTES.ADMIN_LIVE_RESULTS, Icon: BarChart3 },
  { label: 'Participation', path: ROUTES.ADMIN_PARTICIPATION, Icon: Users },
  { label: 'Appreciation', path: ROUTES.ADMIN_APPRECIATION, Icon: MessageSquareHeart },
  { label: 'Results', path: ROUTES.ADMIN_FINAL_RESULTS, Icon: Trophy },
  { label: 'Event Mode', path: ROUTES.ADMIN_EVENT_MODE, Icon: Presentation },
  { label: 'Settings', path: ROUTES.ADMIN_SETTINGS, Icon: Settings },
];

interface AdminSidebarProps {
  onLogout?: () => void;
}

export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  // Listen for toggle event from AdminHeader
  useEffect(() => {
    const handleToggle = () => {
      setIsMobileDrawerOpen((prev) => !prev);
    };

    window.addEventListener('td_toggle_admin_drawer', handleToggle);
    return () => {
      window.removeEventListener('td_toggle_admin_drawer', handleToggle);
    };
  }, []);

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await signOut();
      navigate(ROUTES.LOGIN, { replace: true });
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: isCollapsed ? 72 : 256 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 flex-col border-r border-white/[0.06]"
        role="navigation"
        aria-label="Admin navigation"
      >
        <div className="absolute inset-0 bg-surface-950/95 backdrop-blur-xl" />

        <div className="relative flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Award size={18} className="text-white" />
            </div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <span className="text-sm font-bold text-white">{APP_NAME}</span>
                  <span className="text-[10px] text-gold-400 font-semibold ml-1">{APP_YEAR}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Nav Items */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">
            {adminNavItems.map(({ label, path, Icon, exact }) => {
              const active = isActive(path, exact);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    active
                      ? 'text-white bg-primary-500/15 border border-primary-500/20 shadow-sm'
                      : 'text-surface-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  title={isCollapsed ? label : undefined}
                >
                  <Icon
                    size={18}
                    className={`flex-shrink-0 ${
                      active ? 'text-primary-400' : 'group-hover:text-white'
                    }`}
                  />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="border-t border-white/[0.06] px-2 py-3 space-y-1">
            <Link
              to={ROUTES.HOME}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              title={isCollapsed ? 'Back to Site' : undefined}
            >
              <ChevronLeft size={18} />
              {!isCollapsed && <span>Back to Site</span>}
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title={isCollapsed ? 'Log Out' : undefined}
            >
              <LogOut size={18} />
              {!isCollapsed && <span>Log Out</span>}
            </button>
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-800 border border-surface-600 flex items-center justify-center text-surface-400 hover:text-white hover:bg-surface-700 transition-all z-10"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-[280px] max-w-[85vw] h-full bg-surface-950/95 backdrop-blur-2xl border-r border-white/[0.08] shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-sm">
                    <Award size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block leading-tight">{APP_NAME}</span>
                    <span className="text-[10px] text-primary-400 font-semibold">Admin Panel {APP_YEAR}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Admin Profile Info */}
              <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-surface-200 truncate">
                    {profile?.full_name || 'Admin Master'}
                  </span>
                </div>
                <span className="text-[10px] bg-primary-500/20 text-primary-300 font-bold px-2 py-0.5 rounded-full">
                  SUPERUSER
                </span>
              </div>

              {/* Navigation Links — All 10 Features */}
              <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 scrollbar-hide">
                <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 px-2 pb-1">
                  Admin Tools & Features (10)
                </p>
                {adminNavItems.map(({ label, path, Icon, exact }) => {
                  const active = isActive(path, exact);
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        active
                          ? 'text-white bg-primary-500/20 border border-primary-500/30 font-semibold shadow-sm'
                          : 'text-surface-300 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={active ? 'text-primary-400' : 'text-surface-400'} />
                        <span>{label}</span>
                      </div>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div className="p-3 border-t border-white/[0.08] space-y-1.5 bg-surface-950/80">
                <Link
                  to={ROUTES.HOME}
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-surface-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <ChevronLeft size={16} />
                  <span>Exit to Student Site</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Log Out Administrator</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-surface-950/95 backdrop-blur-xl"
        role="navigation"
        aria-label="Admin mobile quick navigation"
      >
        <div className="flex items-center justify-around px-1 py-1 pb-safe">
          {/* 1. Dashboard */}
          <Link
            to={ROUTES.ADMIN_DASHBOARD}
            className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
              isActive(ROUTES.ADMIN_DASHBOARD, true) ? 'text-primary-400 font-semibold' : 'text-surface-400'
            }`}
          >
            <LayoutDashboard size={18} strokeWidth={isActive(ROUTES.ADMIN_DASHBOARD, true) ? 2.5 : 2} />
            <span className="text-[10px]">Dashboard</span>
          </Link>

          {/* 2. Teachers */}
          <Link
            to={ROUTES.ADMIN_TEACHERS}
            className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
              isActive(ROUTES.ADMIN_TEACHERS) ? 'text-primary-400 font-semibold' : 'text-surface-400'
            }`}
          >
            <GraduationCap size={18} strokeWidth={isActive(ROUTES.ADMIN_TEACHERS) ? 2.5 : 2} />
            <span className="text-[10px]">Teachers</span>
          </Link>

          {/* 3. Categories */}
          <Link
            to={ROUTES.ADMIN_CATEGORIES}
            className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
              isActive(ROUTES.ADMIN_CATEGORIES) ? 'text-primary-400 font-semibold' : 'text-surface-400'
            }`}
          >
            <FolderOpen size={18} strokeWidth={isActive(ROUTES.ADMIN_CATEGORIES) ? 2.5 : 2} />
            <span className="text-[10px]">Categories</span>
          </Link>

          {/* 4. Voting Control */}
          <Link
            to={ROUTES.ADMIN_VOTING}
            className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all ${
              isActive(ROUTES.ADMIN_VOTING) ? 'text-primary-400 font-semibold' : 'text-surface-400'
            }`}
          >
            <Vote size={18} strokeWidth={isActive(ROUTES.ADMIN_VOTING) ? 2.5 : 2} />
            <span className="text-[10px]">Voting</span>
          </Link>

          {/* 5. More (Opens Full 10-feature Drawer) */}
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-xl text-primary-400 hover:text-white transition-all"
            aria-label="Open all admin features"
          >
            <Menu size={18} strokeWidth={2.2} />
            <span className="text-[10px] font-semibold">All Tools</span>
          </button>
        </div>
      </nav>
    </>
  );
}
