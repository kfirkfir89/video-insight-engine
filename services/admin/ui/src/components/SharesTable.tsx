import { useSharesTop } from '../hooks/use-admin-api';
import { getOutputTypeLabel } from '../lib/constants';
import { EyeIcon, HeartIcon } from './icons';

export function SharesTable({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useSharesTop(days);

  if (isLoading || !data) {
    return <div className="h-64 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] flex items-center justify-center">
        <p className="text-sm text-[var(--color-text-faint)]">No shared outputs yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] overflow-hidden" data-testid="shares-table">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Top Shared Outputs</h3>
      </div>
      <div className="overflow-x-auto">
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
    </div>
  );
}
