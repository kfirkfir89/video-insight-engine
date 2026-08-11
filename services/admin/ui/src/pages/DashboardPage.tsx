import { Link } from 'react-router-dom';
import { AlertsBanner } from '../components/AlertsBanner';
import { CostChart } from '../components/CostChart';
import { CostBreakdownSwitcher } from '../components/CostBreakdownSwitcher';
import { ServiceHealth } from '../components/ServiceHealth';
import { SharesTable } from '../components/SharesTable';
import { StatsCards } from '../components/StatsCards';
import { TierDistribution } from '../components/TierDistribution';
import { useUsageByVideo } from '../hooks/use-admin-api';
import type { VideoSummaryItem } from '../lib/api';
import { formatCost, formatNumber, formatDuration, timeAgo } from '../lib/format';
import { VideoIcon, VideoPlayIcon, ArrowRightIcon } from '../components/icons';
import { SkeletonPanel } from '../components/SkeletonPanel';
import { ErrorState } from '../components/ErrorState';

function VideoCard({ video: v }: { video: VideoSummaryItem }) {
  return (
    <Link
      to={`/videos/${v.video_id}`}
      className="group p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-primary)]/40 transition-colors"
    >
      <div className="flex items-start gap-2.5 mb-2">
        {v.thumbnail_url ? (
          <img
            src={v.thumbnail_url}
            alt=""
            className="w-16 h-9 rounded object-cover flex-shrink-0 bg-[var(--color-border)]"
          />
        ) : (
          <div className="w-16 h-9 rounded bg-[var(--color-surface-dim)] flex-shrink-0 flex items-center justify-center text-[var(--color-text-faint)]">
            <VideoPlayIcon size={14} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate group-hover:text-[var(--color-primary)] transition-colors">
            {v.title ?? v.video_id}
          </p>
          <p className="text-[10px] text-[var(--color-text-faint)] truncate">
            {v.channel ?? '—'}
            {v.duration != null && <span className="ml-1">{formatDuration(v.duration)}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-primary)]">{formatCost(v.cost_usd)}</span>
        <span>{formatNumber(v.calls)} calls</span>
        <span className="ml-auto text-[var(--color-text-faint)]">{timeAgo(v.last_call)}</span>
      </div>
    </Link>
  );
}

function RecentVideosStrip({ days }: { days: number }) {
  const { data: videos, isLoading, isError, error, refetch } = useUsageByVideo(days, 5);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} title="Failed to load recent videos" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 rounded bg-[var(--color-surface-dim)] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonPanel key={i} size="md" />
          ))}
        </div>
      </div>
    );
  }

  if (!videos || videos.length === 0) return null;

  const topVideosCost = videos.reduce((sum, v) => sum + v.cost_usd, 0);
  const avgCostPerVideo = videos.length > 0 ? topVideosCost / videos.length : 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-primary)]"><VideoIcon size={16} /></span>
          <h2 className="text-sm font-semibold">Recent Videos</h2>
          {avgCostPerVideo > 0 && (
            <span className="text-xs text-[var(--color-text-faint)] ml-2">
              avg {formatCost(avgCostPerVideo)}/video
            </span>
          )}
        </div>
        <Link
          to="/videos"
          className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          View all <ArrowRightIcon />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" data-testid="recent-videos">
        {videos.map((v) => (
          <VideoCard key={v.video_id} video={v} />
        ))}
      </div>
    </section>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</h2>
      <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
    </div>
  );
}

interface DashboardPageProps {
  days?: number;
}

export function DashboardPage({ days = 30 }: DashboardPageProps) {
  return (
    <div className="space-y-6">
      <AlertsBanner />

      {/* Hero stats */}
      <StatsCards days={days} />

      {/* Recent videos — the visual centerpiece */}
      <RecentVideosStrip days={days} />

      {/* Charts section */}
      <SectionDivider label="Analytics" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostChart days={days} />
        <TierDistribution />
      </div>
      <CostBreakdownSwitcher days={days} />

      {/* Share analytics */}
      <SectionDivider label="Community" />
      <SharesTable days={days} />

      {/* Service health — compact at bottom */}
      <SectionDivider label="Services" />
      <ServiceHealth />
    </div>
  );
}
