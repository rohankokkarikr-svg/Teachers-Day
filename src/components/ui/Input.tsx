import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, icon, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : `input-${autoId}`);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="input-label">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`${error ? 'input-error' : 'input'} ${
              icon ? 'pl-10' : ''
            } ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="input-error-text" role="alert">
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={`${inputId}-helper`} className="input-helper">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
