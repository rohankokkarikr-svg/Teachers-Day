interface BadgeProps {
  variant?: 'primary' | 'gold' | 'success' | 'danger' | 'neutral' | 'live';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses = {
  primary: 'badge-primary',
  gold: 'badge-gold',
  success: 'badge-success',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
  live: 'badge-live',
};

export default function Badge({ variant = 'primary', children, icon, className = '' }: BadgeProps) {
  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
