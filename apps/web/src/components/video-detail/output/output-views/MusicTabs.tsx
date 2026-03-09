import type { MusicGuideOutput } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { formatDuration } from '../../../../lib/string-utils';

interface MusicTabsProps {
  data: MusicGuideOutput;
  activeTab: string;
}

export function MusicTabs({ data, activeTab }: MusicTabsProps) {
  switch (activeTab) {
    case 'credits':
      return (
        <div className="flex flex-col gap-4">
          {/* Song info */}
          <GlassCard variant="elevated" className="text-center">
            <h3 className="text-lg font-bold">{data.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{data.artist}</p>
            {data.genre.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {data.genre.map((g) => (
                  <span key={g} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </GlassCard>
          {/* Credits list */}
          {data.credits.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Credits</h4>
              <div className="flex flex-col gap-2">
                {data.credits.map((credit, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{credit.role}</span>
                    <span className="font-medium">{credit.name}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
          {/* Themes */}
          {data.themes.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Themes</h4>
              <div className="flex flex-wrap gap-2">
                {data.themes.map((theme) => (
                  <span key={theme} className="rounded-full bg-muted px-3 py-1 text-xs">
                    {theme}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      );

    case 'analysis':
      return (
        <GlassCard>
          <p className="text-sm leading-relaxed whitespace-pre-line">{data.analysis}</p>
        </GlassCard>
      );

    case 'structure':
      return (
        <div className="flex flex-col gap-2">
          {data.structure.map((section, i) => (
            <GlassCard key={i} variant="interactive" className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold">{section.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-2">
                  {section.timestamp !== undefined && (
                    <span className="font-mono">{formatDuration(section.timestamp)}</span>
                  )}
                  {section.duration !== undefined && (
                    <span>({Math.round(section.duration)}s)</span>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      );

    case 'lyrics':
      return (
        <GlassCard>
          <div className="flex flex-col gap-1">
            {data.lyrics.map((line, i) => (
              <div key={i} className="flex gap-3 items-baseline">
                {line.timestamp !== undefined && (
                  <span className="shrink-0 text-xs font-mono text-muted-foreground w-10 text-right">
                    {formatDuration(line.timestamp)}
                  </span>
                )}
                <p className="text-sm leading-relaxed">{line.line}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      );

    default:
      return null;
  }
}
