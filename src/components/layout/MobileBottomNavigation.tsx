import { Link, useLocation } from 'react-router-dom';
import { Home, Vote, Heart, User } from 'lucide-react';
import { ROUTES } from '../../lib/constants';

const navItems = [
  { label: 'Home', path: ROUTES.HOME, Icon: Home },
  { label: 'Vote', path: ROUTES.VOTE, Icon: Vote },
  { label: 'Wall', path: ROUTES.APPRECIATION, Icon: Heart },
  { label: 'Profile', path: ROUTES.PROFILE, Icon: User },
];

export default function MobileBottomNavigation() {
  const location = useLocation();

  // Hide on Category Voting page where dedicated voting action bar is shown
  const isCategoryVotePage = location.pathname.startsWith('/vote/') && location.pathname !== '/vote';
  if (isCategoryVotePage) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === ROUTES.HOME) return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06]"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="absolute inset-0 bg-surface-950/90 backdrop-blur-xl" />
      <div className="relative flex items-center justify-around px-2 pb-safe"
           style={{ height: 'var(--bottom-nav-height)' }}
      >
        {navItems.map(({ label, path, Icon }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 rounded-xl transition-all duration-200 tap-target ${
                active
                  ? 'text-primary-400'
                  : 'text-surface-500 active:text-surface-300'
              }`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-400" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-primary-400' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
