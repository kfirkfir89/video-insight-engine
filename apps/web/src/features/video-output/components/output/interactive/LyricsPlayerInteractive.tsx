import { memo, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard, FadeIn, SectionNav, ExpandableCard } from '@/components/vie';


interface LyricLine {
  line: string;
  timestamp?: number;
}

interface LyricsSection {
  name: string;
  timestamp?: number;
  lines: LyricLine[];
  analysis?: string;
}

interface LyricsPlayerInteractiveProps {
  sections: LyricsSection[];
  artist?: string;
  onSeek?: (seconds: number) => void;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const LyricsPlayerInteractive = memo(function LyricsPlayerInteractive({
  sections,
  artist,
  onSeek,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: LyricsPlayerInteractiveProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.name ?? '');

  if (sections.length === 0) return null;

  const sectionNav = sections.length > 1
    ? sections.map((s) => ({ id: s.name, label: s.name }))
    : null;

  const currentSection = sections.find((s) => s.name === activeSection) ?? sections[0];

  return (
    <div className="space-y-4">
      {/* Artist header */}
      {artist && (
        <div className="text-center">
          <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">{artist}</span>
        </div>
      )}

      {/* Section navigation */}
      {sectionNav && (
        <SectionNav sections={sectionNav} activeId={activeSection} onSelect={setActiveSection} />
      )}

      {/* Lyrics display */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{currentSection.name}</h4>
          {currentSection.timestamp != null && onSeek && (
            <Button
              variant="ghost"
              size="bare"
              onClick={() => onSeek(currentSection.timestamp!)}
              dir="ltr"
              className="text-xs text-[color:var(--vie-accent)] gap-1"
            >
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatTime(currentSection.timestamp)}
            </Button>
          )}
        </div>

        <div className="space-y-1">
          {currentSection.lines.map((line, index) => (
            <FadeIn key={index} index={index}>
              <div className={cn('flex items-start gap-2 py-1', onSeek && line.timestamp != null && 'cursor-pointer hover:bg-muted/20 rounded-md px-2 -mx-2')}>
                {line.timestamp != null && onSeek && (
                  <Button
                    variant="ghost"
                    size="bare"
                    onClick={() => onSeek(line.timestamp!)}
                    dir="ltr"
                    className="text-xs tabular-nums text-muted-foreground/50 shrink-0 mt-0.5"
                  >
                    {formatTime(line.timestamp)}
                  </Button>
                )}
                <p dir="auto" className="text-sm leading-relaxed italic text-foreground/90">{line.line}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </GlassCard>

      {/* Analysis */}
      {currentSection.analysis && (
        <FadeIn>
          <ExpandableCard header={<span className="text-xs font-medium">Musical Analysis</span>}>
            <p className="text-sm text-muted-foreground">{currentSection.analysis}</p>
          </ExpandableCard>
        </FadeIn>
      )}

    </div>
  );
});
