import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import type { ButtonVariant, ButtonSize } from '../../types';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  gold: 'btn-gold',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconRight,
      fullWidth = false,
      children,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
        className={`${variantClasses[variant]} ${sizeClasses[size]} ${
          fullWidth ? 'w-full' : ''
        } ${className}`}
        disabled={disabled || isLoading}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          icon
        )}
        {children}
        {iconRight && !isLoading && iconRight}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
