/**
 * Status Indicators Component - Dev Only
 *
 * Displays all status states with icons and colors.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('StatusIndicators should not be imported in production');
}

import { Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusConfig {
  name: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  description: string;
}

const statuses: StatusConfig[] = [
  {
    name: 'pending',
    label: 'Pending',
    icon: <Clock className="h-4 w-4" />,
    colorClass: 'text-status-pending',
    bgClass: 'bg-status-pending/10',
    description: 'Waiting to be processed',
  },
  {
    name: 'processing',
    label: 'Processing',
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    colorClass: 'text-status-processing',
    bgClass: 'bg-status-processing/10',
    description: 'Currently being processed',
  },
  {
    name: 'success',
    label: 'Completed',
    icon: <CheckCircle className="h-4 w-4" />,
    colorClass: 'text-status-success',
    bgClass: 'bg-status-success/10',
    description: 'Successfully completed',
  },
  {
    name: 'error',
    label: 'Failed',
    icon: <XCircle className="h-4 w-4" />,
    colorClass: 'text-status-error',
    bgClass: 'bg-status-error/10',
    description: 'An error occurred',
  },
];

function StatusBadge({ status }: { status: StatusConfig }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium',
        status.colorClass,
        status.bgClass
      )}
    >
      {status.icon}
      {status.label}
    </span>
  );
}

export function StatusIndicators() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Status Indicators</h2>
        <p className="text-muted-foreground">
          Status states for displaying processing progress and results.
        </p>
      </div>

      {/* Status Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statuses.map((status) => (
          <div
            key={status.name}
            className="rounded-lg border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{status.name}</span>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground">{status.description}</p>
            <div className="pt-2 border-t">
              <code className="text-xs text-muted-foreground font-mono">
                {status.colorClass}
              </code>
            </div>
          </div>
        ))}
      </div>

      {/* Usage Examples */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Usage Examples</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* In Cards */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">In Video Cards</p>
            <div className="rounded-lg border p-3 flex items-center gap-3">
              <div className="h-16 w-24 rounded bg-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">Video Title Here</p>
                <StatusBadge status={statuses[1]} />
              </div>
            </div>
          </div>

          {/* Inline */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Inline Status</p>
            <div className="space-y-2">
              <p className="text-sm">
                Status: <span className="text-status-success font-medium">Completed</span>
              </p>
              <p className="text-sm">
                Status: <span className="text-status-processing font-medium">Processing</span>
              </p>
              <p className="text-sm">
                Status: <span className="text-status-error font-medium">Failed</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Icon Only */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Icon Only</h3>
        <div className="flex items-center gap-6">
          {statuses.map((status) => (
            <div key={status.name} className="flex flex-col items-center gap-2">
              <span className={cn('p-2 rounded-full', status.bgClass, status.colorClass)}>
                {status.icon}
              </span>
              <span className="text-xs text-muted-foreground">{status.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
