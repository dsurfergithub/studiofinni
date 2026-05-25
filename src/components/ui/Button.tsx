import React from 'react';
import { cn } from '../../lib/utils';
import { playClick } from '../../lib/audio/sounds';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', onClick, ...props }, ref) => {
    const handleOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      playClick();
      if (onClick) onClick(e);
    };

    return (
      <button
        ref={ref}
        onClick={handleOnClick}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-gradient-to-r from-accent to-accent-strong text-white hover:opacity-90 shadow-[0_0_15px_rgba(183,148,255,0.2)]': variant === 'primary',
            'bg-surface-elevated text-text hover:bg-border border border-border': variant === 'secondary',
            'bg-transparent text-muted hover:text-text hover:bg-surface-elevated': variant === 'ghost',
            'bg-danger-soft text-danger hover:bg-[rgba(255,84,120,0.15)]': variant === 'danger',
            'bg-accent-soft text-accent hover:bg-[rgba(183,148,255,0.15)]': variant === 'accent',
            'h-9 px-3 text-sm': size === 'sm',
            'h-11 px-5 text-base': size === 'md',
            'h-14 px-6 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
