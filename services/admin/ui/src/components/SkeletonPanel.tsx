type SkeletonSize = 'sm' | 'md' | 'lg' | 'xl';

interface SkeletonPanelProps {
  size?: SkeletonSize;
  count?: number;
  className?: string;
}

const SIZE_CLASS: Record<SkeletonSize, string> = {
  sm: 'h-16',
  md: 'h-24',
  lg: 'h-32',
  xl: 'h-48',
};

export function SkeletonPanel({ size = 'md', count = 1, className }: SkeletonPanelProps) {
  const tile = [
    'rounded-xl bg-[var(--color-surface-dim)] border border-[var(--color-border)] animate-pulse',
    SIZE_CLASS[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (count <= 1) {
    return <div className={tile} data-slot="skeleton-panel" data-size={size} />;
  }

  return (
    <div className="flex flex-col gap-3" data-slot="skeleton-panel-group">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={tile}
          data-slot="skeleton-panel"
          data-size={size}
        />
      ))}
    </div>
  );
}
