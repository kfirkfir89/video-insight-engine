import { Link, useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useVideoDetail } from '../hooks/use-admin-api';
import { formatCost, formatDuration, timeAgo, formatNumber } from '../lib/format';
import { ArrowLeftIcon, DollarIcon, ZapIcon, HashIcon, ClockIcon } from '../components/icons';

const STAT_CONFIG = [
  { key: 'cost', icon: DollarIcon, color: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
  { key: 'calls', icon: ZapIcon, color: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  { key: 'tokens', icon: HashIcon, color: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
  { key: 'duration', icon: ClockIcon, color: 'var(--color-text-muted)', soft: 'var(--color-surface-dim)' },
];

export function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const { data, isLoading } = useVideoDetail(videoId);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Link to="/videos" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline">
          <ArrowLeftIcon /> Back to Videos
        </Link>
        <div className="h-32 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />
        <div className="h-48 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />
      </div>
    );
  }

  const { video, summary, by_feature, calls } = data;

  const statCards = [
    { label: 'Total Cost', value: formatCost(summary.total_cost_usd), ...STAT_CONFIG[0] },
    { label: 'LLM Calls', value: formatNumber(summary.total_calls), ...STAT_CONFIG[1] },
    { label: 'Total Tokens', value: formatNumber(summary.total_tokens_in + summary.total_tokens_out), ...STAT_CONFIG[2] },
    { label: 'Avg Duration', value: `${Math.round(summary.avg_duration_ms)}ms`, ...STAT_CONFIG[3] },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/videos"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary)]/15 transition-colors"
      >
        <ArrowLeftIcon /> Back to Videos
      </Link>

      {/* Video header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        {video?.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt=""
            className="w-44 h-[100px] rounded-lg object-cover flex-shrink-0 bg-[var(--color-border)]"
          />
        ) : (
          <div className="w-44 h-[100px] rounded-lg bg-[var(--color-surface-dim)] flex-shrink-0 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold truncate">{video?.title ?? videoId}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {video?.channel ?? '—'}
            {video?.duration != null && <span className="ml-3 text-[var(--color-text-faint)]">{formatDuration(video.duration)}</span>}
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {video?.category && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                {video.category}
              </span>
            )}
            {video?.status && (
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                video.status === 'completed'
                  ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                  : video.status === 'error'
                    ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                    : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
              }`}>
                {video.status}
              </span>
            )}
            {video?.processed_at && (
              <span className="text-[11px] text-[var(--color-text-faint)]">
                Processed {timeAgo(video.processed_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="p-4 rounded-xl border border-[var(--color-border)]"
              style={{ background: c.soft, borderLeft: `4px solid ${c.color}` }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ color: c.color }}><Icon /></span>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">{c.label}</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Feature breakdown chart */}
      {by_feature.length > 0 && (
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Cost by Feature</h3>
          <ResponsiveContainer width="100%" height={Math.max(140, by_feature.length * 56)}>
            <BarChart data={by_feature} layout="vertical" margin={{ right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} width={140} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(4)}`, 'Cost']}
              />
              <Bar dataKey="cost_usd" fill="var(--color-primary)" radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey="cost_usd"
                  position="right"
                  formatter={(v) => `$${Number(v ?? 0).toFixed(4)}`}
                  style={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Individual LLM calls table */}
      {calls.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] overflow-hidden">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] p-4 pb-2">
            Individual Calls ({calls.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dim)]">
                  <th className="text-left p-2 pl-4 font-medium text-[var(--color-text-muted)]">Model</th>
                  <th className="text-left p-2 font-medium text-[var(--color-text-muted)]">Feature</th>
                  <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Cost</th>
                  <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Tokens</th>
                  <th className="text-right p-2 font-medium text-[var(--color-text-muted)]">Duration</th>
                  <th className="text-right p-2 pr-4 font-medium text-[var(--color-text-muted)]">Time</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((row, i) => (
                  <tr key={row._id ?? i} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-primary-soft)] transition-colors">
                    <td className="p-2 pl-4 font-mono truncate max-w-[180px]">{row.model}</td>
                    <td className="p-2 truncate max-w-[120px]">{row.feature}</td>
                    <td className="p-2 text-right font-mono font-medium text-[var(--color-primary)]">{formatCost(row.cost_usd)}</td>
                    <td className="p-2 text-right">{row.tokens_in + row.tokens_out}</td>
                    <td className="p-2 text-right">{row.duration_ms}ms</td>
                    <td className="p-2 pr-4 text-right text-[var(--color-text-muted)]">
                      {timeAgo(row.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
