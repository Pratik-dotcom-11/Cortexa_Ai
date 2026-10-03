import React from 'react';
import { cn } from '../../utils/cn';

export const LoadingSkeleton: React.FC<{ className?: string; lines?: number }> = ({
  className,
  lines = 1,
}) => {
  if (lines > 1) {
    return (
      <div className="space-y-2.5 w-full">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 bg-slate-800/80 rounded-md animate-pulse',
              i === lines - 1 ? 'w-2/3' : 'w-full',
              className
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('h-4 bg-slate-800/80 rounded-md animate-pulse', className)}
    />
  );
};
