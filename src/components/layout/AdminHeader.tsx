import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Shield } from 'lucide-react';
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

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06]">
      <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-xl" />
      <div className="relative flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-500 flex items-center gap-1">
            <Shield size={14} className="text-primary-400" /> Admin
          </span>
          <ChevronRight size={14} className="text-surface-600" />
          <span className="text-white font-medium">{currentPage}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-surface-400 font-medium">
              {profile?.full_name || 'Admin'}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut size={14} className="text-rose-400" />}
            onClick={handleLogout}
            className="text-xs text-surface-300 hover:text-rose-300"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
