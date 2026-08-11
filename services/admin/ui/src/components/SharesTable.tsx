import { useSharesTop } from '../hooks/use-admin-api';
import { getOutputTypeLabel } from '../lib/constants';
import { EyeIcon, HeartIcon } from './icons';
import { Panel } from './Panel';
import { SkeletonPanel } from './SkeletonPanel';
import { ErrorState } from './ErrorState';

export function SharesTable({ days = 30 }: { days?: number }) {
  const { data, isLoading, isError, error, refetch } = useSharesTop(days);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Failed to load shares" />;
  }

  if (isLoading || !data) {
    return <SkeletonPanel size="xl" />;
  }

  if (data.length === 0) {
    return (
      <Panel title="Top Shared Outputs" tone="raised" padding="md">
        <div className="h-40 flex items-center justify-center">
          <p className="text-sm text-[var(--color-text-faint)]">No shared outputs yet</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Top Shared Outputs" tone="raised" padding="none">
      <div className="overflow-x-auto" data-testid="shares-table">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-faint)]">
              <th className="text-left px-4 py-2 font-medium">Title</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-right px-4 py-2 font-medium">Views</th>
              <th className="text-right px-4 py-2 font-medium">Likes</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.shareSlug} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-dim)] transition-colors">
                <td className="px-4 py-2.5 max-w-[200px] truncate font-medium text-[var(--color-text)]">
                  {item.title ?? item.youtubeId}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-dim)] text-[var(--color-text-muted)]">
                    {getOutputTypeLabel(item.outputType)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                    <EyeIcon size={12} /> {item.viewsCount.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                    <HeartIcon size={12} /> {item.likesCount.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
