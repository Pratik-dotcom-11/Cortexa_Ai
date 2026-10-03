import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className,
}) => {
  const typeConfig = {
    info: {
      bg: 'bg-indigo-950/40 border-indigo-800/40 text-indigo-300',
      icon: <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-amber-950/40 border-amber-800/40 text-amber-300',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
    },
    error: {
      bg: 'bg-rose-950/40 border-rose-800/40 text-rose-300',
      icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed',
        config.bg,
        className
      )}
    >
      {config.icon}
      <div className="flex-1">
        {title && <p className="font-semibold text-white mb-0.5">{title}</p>}
        <p>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white cursor-pointer p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
