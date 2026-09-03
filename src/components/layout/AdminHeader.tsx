import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Shield, Menu } from 'lucide-react';
import { ROUTES } from '../../lib/constants';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';

const breadcrumbMap: Record<string, string> = {
  [ROUTES.ADMIN_DASHBOARD]: 'Dashboard',
  [ROUTES.ADMIN_TEACHERS]: 'Teachers',
  [ROUTES.ADMIN_CATEGORIES]: 'Categories',
  [ROUTES.ADMIN_VOTING]: 'Voting Control',
  [ROUTES.ADMIN_LIVE_RESULTS]: 'Live Results',
  [ROUTES.ADMIN_PARTICIPATION]: 'Participation',
  [ROUTES.ADMIN_APPRECIATION]: 'Appreciation',
  [ROUTES.ADMIN_FINAL_RESULTS]: 'Results',
  [ROUTES.ADMIN_EVENT_MODE]: 'Event Mode',
  [ROUTES.ADMIN_SETTINGS]: 'Settings',
};

export default function AdminHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const currentPage = breadcrumbMap[location.pathname] || 'Admin';

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const handleToggleMobileDrawer = () => {
    window.dispatchEvent(new Event('td_toggle_admin_drawer'));
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06]">
      <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-xl" />
      <div className="relative flex items-center justify-between h-16 px-3.5 md:px-6">
        {/* Left Side: Mobile Menu Button & Breadcrumb */}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <button
            onClick={handleToggleMobileDrawer}
            className="md:hidden p-2 -ml-1 rounded-xl text-surface-300 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Open Admin Menu"
          >
            <Menu size={20} />
          </button>

          <span className="text-surface-500 hidden sm:flex items-center gap-1 flex-shrink-0">
            <Shield size={14} className="text-primary-400" /> Admin
          </span>
          <ChevronRight size={14} className="text-surface-600 hidden sm:inline" />
          <span className="text-white font-semibold truncate">{currentPage}</span>
        </div>

        {/* Right Side: Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-surface-400 font-medium truncate max-w-[120px]">
              {profile?.full_name || 'Admin'}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut size={14} className="text-rose-400" />}
            onClick={handleLogout}
            className="text-xs text-surface-300 hover:text-rose-300 px-2.5 sm:px-3"
          >
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
