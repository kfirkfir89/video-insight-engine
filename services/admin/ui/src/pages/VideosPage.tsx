import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUsageByVideo, useVideoDetail } from '../hooks/use-admin-api';
import type { VideoSummaryItem } from '../lib/api';
import { formatCost, formatDuration, timeAgo, formatNumber } from '../lib/format';
import { DollarIcon, ZapIcon, VideoPlayIcon, ChevronRightIcon } from '../components/icons';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span
      className="inline-flex transition-transform duration-200"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <ChevronRightIcon />
    </span>
  );
}

function StatusDot({ status }: { status: string | null }) {
  const color =
    status === 'completed' ? 'var(--color-success)' :
    status === 'processing' ? 'var(--color-warning)' :
    status === 'error' ? 'var(--color-danger)' :
    'var(--color-text-muted)';
  return (
    <span
      className="inline-block w-2 h-2 rounded-full"
      style={{ background: color }}
      title={status ?? 'unknown'}
    />
  );
}

function SummaryStats({ data }: { data: Array<{ calls: number; cost_usd: number }> }) {
  const totalVideos = data.length;
  const totalCost = data.reduce((sum, v) => sum + v.cost_usd, 0);
  const totalCalls = data.reduce((sum, v) => sum + v.calls, 0);

  const stats = [
    { label: 'Videos', value: formatNumber(totalVideos), icon: VideoPlayIcon, color: 'var(--color-accent)', soft: 'var(--color-accent-soft)' },
    { label: 'Total Spend', value: formatCost(totalCost), icon: DollarIcon, color: 'var(--color-primary)', soft: 'var(--color-primary-soft)' },
    { label: 'Total Calls', value: formatNumber(totalCalls), icon: ZapIcon, color: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="p-3 rounded-xl border border-[var(--color-border)]"
            style={{ background: s.soft, borderLeft: `3px solid ${s.color}` }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ color: s.color }}><Icon /></span>
              <span className="text-[10px] font-medium text-[var(--color-text-muted)]">{s.label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Inline expanded call details fetched on demand */
function VideoCallsPanel({ videoId }: { videoId: string }) {
  const { data, isLoading } = useVideoDetail(videoId);

  if (isLoading || !data) {
    return (
      <div className="px-4 py-3">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 w-24 rounded bg-[var(--color-border)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { calls, by_feature } = data;

  if (calls.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        No individual calls recorded.
      </div>
    );
  }

  return (
    <div className="px-4 pt-1 pb-3 space-y-3">
      {/* Feature summary pills */}
      {by_feature.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {by_feature.map((f) => (
            <span
              key={f.feature}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
            >
              {f.feature}
              <span className="text-[var(--color-text-faint)]">{f.calls} calls</span>
              <span className="font-bold">{formatCost(f.cost_usd)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Calls table */}
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[var(--color-surface-dim)] border-b border-[var(--color-border)]">
                <th className="text-left py-1.5 px-3 font-medium text-[var(--color-text-faint)]">Model</th>
                <th className="text-left py-1.5 px-3 font-medium text-[var(--color-text-faint)]">Feature</th>
                <th className="text-right py-1.5 px-3 font-medium text-[var(--color-text-faint)]">Cost</th>
                <th className="text-right py-1.5 px-3 font-medium text-[var(--color-text-faint)] hidden sm:table-cell">Tokens</th>
                <th className="text-right py-1.5 px-3 font-medium text-[var(--color-text-faint)] hidden md:table-cell">Duration</th>
                <th className="text-right py-1.5 px-3 font-medium text-[var(--color-text-faint)]">When</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((row, i) => (
                <tr
                  key={row._id ?? i}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-dim)] transition-colors"
                >
                  <td className="py-1.5 px-3 font-mono truncate max-w-[160px]">{row.model}</td>
                  <td className="py-1.5 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-surface-dim)]">
                      {row.feature}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-medium text-[var(--color-primary)]">
                    {formatCost(row.cost_usd)}
                  </td>
                  <td className="py-1.5 px-3 text-right hidden sm:table-cell">
                    {formatNumber(row.tokens_in + row.tokens_out)}
                  </td>
                  <td className="py-1.5 px-3 text-right text-[var(--color-text-muted)] hidden md:table-cell">
                    {row.duration_ms}ms
                  </td>
                  <td className="py-1.5 px-3 text-right text-[var(--color-text-faint)]">
                    {timeAgo(row.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function VideosPage() {
  const { data, isLoading } = useUsageByVideo(30, 50);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (videoId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Videos</h2>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Videos</h2>
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dim)]">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-text)]">No videos processed yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Videos will appear here once they are summarized or explained.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Videos</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{data.length} videos (last 30 days)</span>
      </div>

      <SummaryStats data={data} />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dim)]">
                <th className="w-8 p-3" />
                <th className="text-left p-3 font-medium text-[var(--color-text-muted)]">Video</th>
                <th className="text-right p-3 font-medium text-[var(--color-text-muted)]">Calls</th>
                <th className="text-right p-3 font-medium text-[var(--color-text-muted)]">Cost</th>
                <th className="text-right p-3 font-medium text-[var(--color-text-muted)] hidden md:table-cell">Tokens</th>
                <th className="text-center p-3 font-medium text-[var(--color-text-muted)] hidden sm:table-cell">Status</th>
                <th className="text-right p-3 pr-4 font-medium text-[var(--color-text-muted)] hidden lg:table-cell">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => {
                const isOpen = expanded.has(v.video_id);
                return (
                  <VideoRow
                    key={v.video_id}
                    video={v}
                    isOpen={isOpen}
                    onToggle={() => toggle(v.video_id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface VideoRowProps {
  video: VideoSummaryItem;
  isOpen: boolean;
  onToggle: () => void;
}

function VideoRow({ video: v, isOpen, onToggle }: VideoRowProps) {
  return (
    <>
      <tr
        className={`border-b border-[var(--color-border)] transition-colors ${
          isOpen
            ? 'bg-[var(--color-primary-soft)] border-b-0'
            : 'hover:bg-[var(--color-surface-dim)]'
        }`}
        style={{ borderLeft: isOpen ? '3px solid var(--color-primary)' : '3px solid transparent' }}
      >
        {/* Expand toggle */}
        <td className="p-3 w-8">
          <button
            onClick={onToggle}
            data-testid={`expand-${v.video_id}`}
            className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-[var(--color-surface-dim)] text-[var(--color-text-muted)] transition-colors"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon open={isOpen} />
          </button>
        </td>

        {/* Video info */}
        <td className="p-3">
          <Link to={`/videos/${v.video_id}`} className="flex items-center gap-3 min-w-0">
            {v.thumbnail_url ? (
              <img
                src={v.thumbnail_url}
                alt=""
                className="w-20 h-[45px] rounded object-cover flex-shrink-0 bg-[var(--color-border)]"
              />
            ) : (
              <div className="w-20 h-[45px] rounded bg-[var(--color-surface-dim)] flex-shrink-0 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium truncate max-w-[300px] text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors">
                {v.title ?? v.video_id}
              </p>
              <p className="text-[var(--color-text-muted)] truncate max-w-[200px]">
                {v.channel ?? '—'}
                {v.duration != null && <span className="ml-2">{formatDuration(v.duration)}</span>}
              </p>
            </div>
          </Link>
        </td>

        <td className="p-3 text-right font-mono">{formatNumber(v.calls)}</td>
        <td className="p-3 text-right font-mono font-bold text-[var(--color-primary)]">
          {formatCost(v.cost_usd)}
        </td>
        <td className="p-3 text-right hidden md:table-cell">
          {formatNumber(v.tokens_in + v.tokens_out)}
        </td>
        <td className="p-3 text-center hidden sm:table-cell">
          <StatusDot status={v.status} />
        </td>
        <td className="p-3 pr-4 text-right text-[var(--color-text-muted)] hidden lg:table-cell">
          {timeAgo(v.last_call)}
        </td>
      </tr>

      {/* Expanded calls panel */}
      {isOpen && (
        <tr style={{ borderLeft: '3px solid var(--color-primary)' }}>
          <td colSpan={7} className="bg-[var(--color-surface)] border-b border-[var(--color-border)]" data-testid={`calls-${v.video_id}`}>
            <VideoCallsPanel videoId={v.video_id} />
          </td>
        </tr>
      )}
    </>
  );
}
