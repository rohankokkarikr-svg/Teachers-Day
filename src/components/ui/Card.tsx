import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'selected' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6 md:p-8',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', children, className = '', ...props }, ref) => {
    const baseClasses = {
      default: 'glass-card',
      hover: 'glass-card-hover cursor-pointer',
      selected:
        'glass-card border-primary-500/40 bg-primary-500/[0.08] ring-1 ring-primary-500/20',
      flat: 'rounded-2xl bg-surface-800/50 border border-surface-700/50',
    };

    return (
      <div
        ref={ref}
        className={`${baseClasses[variant]} ${paddingClasses[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
