import { useQueueStats } from '../hooks/use-admin-api';
import { Panel } from './Panel';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';
import { InfoTip } from './InfoTip';

interface MetricProps {
  label: string;
  value: number;
  emphasis?: 'normal' | 'warn' | 'danger';
}

function Metric({ label, value, emphasis = 'normal' }: MetricProps) {
  const color =
    emphasis === 'danger'
      ? 'var(--color-danger)'
      : emphasis === 'warn'
        ? 'var(--color-warning)'
        : 'var(--color-text)';

  return (
    <div className="text-center" data-testid={`queue-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{label}</p>
    </div>
  );
}

export function QueueStats() {
  const { data, isLoading, isError, error, refetch } = useQueueStats();

  if (isError) {
    return (
      <ErrorState
        error={error}
        onRetry={() => refetch()}
        title="Queue stats unavailable"
      />
    );
  }

  if (isLoading || !data) {
    return <SkeletonPanel size="md" />;
  }

  const dlqHas = data.dlq.messages > 0;
  const noConsumers = data.main.consumers === 0;

  const header = (
    <span className="inline-flex items-center gap-1">
      <span>Pipeline Queue</span>
      <InfoTip label="Queue stats explanation">
        Live counters from the RabbitMQ management API. Ready = waiting for a
        worker; In-flight = currently being processed; DLQ = failed jobs that
        exhausted their retries.
      </InfoTip>
    </span>
  );

  return (
    <Panel title={header} tone="dim" padding="md" data-testid="queue-stats-panel">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Ready" value={data.main.ready} />
        <Metric label="In Flight" value={data.main.inFlight} />
        <Metric
          label="Consumers"
          value={data.main.consumers}
          emphasis={noConsumers ? 'danger' : 'normal'}
        />
        <Metric
          label="DLQ"
          value={data.dlq.messages}
          emphasis={dlqHas ? 'warn' : 'normal'}
        />
      </div>
    </Panel>
  );
}
