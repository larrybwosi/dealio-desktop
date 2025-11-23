import React from 'react';
import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface DetailedToastProps {
  id: string | number;
  title: string;
  message: string;
  type?: NotificationType;
  timestamp?: string;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const typeStyles = {
  info: {
    icon: Info,
    borderColor: 'border-blue-200 dark:border-blue-800',
    backgroundColor: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  success: {
    icon: CheckCircle,
    borderColor: 'border-green-200 dark:border-green-800',
    backgroundColor: 'bg-green-50 dark:bg-green-950/30',
    iconColor: 'text-green-500 dark:text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    backgroundColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
  },
  error: {
    icon: XCircle,
    borderColor: 'border-red-200 dark:border-red-800',
    backgroundColor: 'bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-500 dark:text-red-400',
  },
};

export const DetailedToast: React.FC<DetailedToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  timestamp,
  onDismiss,
  action,
}) => {
  const styles = typeStyles[type];
  const Icon = styles.icon;

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
    toast.dismiss(id);
  };

  return (
    <div
      className={cn(
        'relative w-full max-w-md overflow-hidden rounded-lg border shadow-lg transition-all duration-300',
        styles.borderColor,
        styles.backgroundColor,
        'backdrop-blur-sm'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 shrink-0', styles.iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{title}</h3>
              {timestamp && (
                <span className="text-xs text-muted-foreground">{timestamp}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message}
            </p>
            {action && (
              <button
                onClick={action.onClick}
                className={cn(
                  'mt-2 text-sm font-medium hover:underline focus:outline-none',
                  styles.iconColor
                )}
              >
                {action.label}
              </button>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-70 hover:bg-background/50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>
      
      {/* Progress bar animation could go here if needed */}
    </div>
  );
};
