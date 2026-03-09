import type { HighlightsOutput } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { formatDuration } from '../../../../lib/string-utils';

interface HighlightsTabsProps {
  data: HighlightsOutput;
  activeTab: string;
}

export function HighlightsTabs({ data, activeTab }: HighlightsTabsProps) {
  switch (activeTab) {
    case 'speakers':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.speakers.map((speaker, i) => (
            <GlassCard key={i} variant="interactive">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{speaker.emoji}</span>
                <div>
                  <h4 className="text-sm font-semibold">{speaker.name}</h4>
                  {speaker.role && (
                    <p className="text-xs text-muted-foreground">{speaker.role}</p>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      );

    case 'highlights':
      return (
        <div className="flex flex-col gap-3">
          {data.highlights.map((quote, i) => (
            <GlassCard key={i}>
              <div className="flex gap-3">
                <span className="text-2xl shrink-0">{quote.emoji}</span>
                <div className="flex flex-col gap-1 min-w-0">
                  <blockquote className="text-sm leading-relaxed italic border-l-2 border-primary/30 pl-3">
                    {'\u201C'}{quote.text}{'\u201D'}
                  </blockquote>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-primary">{quote.speaker}</span>
                    {quote.timestamp !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(quote.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      );

    case 'topics':
      return (
        <div className="flex flex-col gap-3">
          {data.topics.map((topic, i) => (
            <GlassCard key={i} variant="interactive">
              <div className="flex gap-3">
                <span className="text-2xl shrink-0">{topic.emoji}</span>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{topic.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {topic.timestamp !== undefined && (
                        <span className="font-mono">{formatDuration(topic.timestamp)}</span>
                      )}
                      {topic.duration !== undefined && (
                        <span>({Math.round(topic.duration / 60)}min)</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{topic.summary}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      );

    default:
      return null;
  }
}
