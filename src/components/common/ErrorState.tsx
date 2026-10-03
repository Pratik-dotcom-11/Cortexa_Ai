import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an unexpected error processing your academic request. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`p-6 sm:p-8 rounded-xl border border-red-200 bg-red-50/50 flex flex-col items-center text-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      <p className="text-sm text-red-700/80 mt-1 mb-5">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={onRetry}
          className="border-red-300 text-red-800 hover:bg-red-100/70"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
