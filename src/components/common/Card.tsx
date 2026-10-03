import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hoverable = false,
  padding = 'md',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-2xl sm:rounded-3xl shadow-xs text-foreground transition-all duration-200 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100',
        hoverable && 'hover:border-indigo-300/80 hover:shadow-md hover:shadow-indigo-500/5 hover:-translate-y-0.5 dark:hover:border-slate-700 dark:hover:shadow-md dark:hover:bg-slate-850',
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
