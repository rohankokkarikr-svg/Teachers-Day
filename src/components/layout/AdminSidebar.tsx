import { useState } from 'react';
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
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
                      ? 'text-white bg-primary-500/15 border border-primary-500/20'
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

      {/* Mobile Bottom Nav for Admin */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06]"
        role="navigation"
        aria-label="Admin mobile navigation"
      >
        <div className="absolute inset-0 bg-surface-950/90 backdrop-blur-xl" />
        <div className="relative flex overflow-x-auto scrollbar-hide px-2 pb-safe gap-1"
             style={{ height: 'var(--bottom-nav-height)' }}
        >
          {adminNavItems.slice(0, 5).map(({ label, path, Icon, exact }) => {
            const active = isActive(path, exact);
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] px-2 py-2 rounded-xl transition-all duration-200 ${
                  active ? 'text-primary-400' : 'text-surface-500'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[9px] font-medium whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
