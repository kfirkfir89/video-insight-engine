import { memo } from 'react';
import { GlassCard } from './GlassCard';
import type {
  KeyPointItem,
  TipItem,
  ReviewSpec,
  NarrativeQuote,
} from '@vie/types';
import {
  CalloutBlock,
  KeyValueRow,
  QuoteBlock,
  StatBlock,
  VerdictBlock,
  ListBlock,
  CodeBlock,
  TableBlock,
} from '../blocks';

interface DisplaySectionProps {
  data: unknown;
  tabId: string;
}

/**
 * Generic display section for non-interactive tabs.
 * Renders domain data using appropriate core blocks based on data shape.
 */
export const DisplaySection = memo(function DisplaySection({ data, tabId }: DisplaySectionProps) {
  if (data == null) {
    return (
      <GlassCard>
        <p className="text-sm text-muted-foreground text-center py-4">
          No data available for this section.
        </p>
      </GlassCard>
    );
  }

  // Handle array of key points
  if (isKeyPoints(data)) {
    return (
      <div className="flex flex-col gap-3">
        {data.map((point, i) => (
          <GlassCard key={i} variant="interactive">
            <div className="flex gap-3">
              <span className="text-xl" aria-hidden="true">{point.emoji}</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">{point.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{point.detail}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }

  // Handle array of analysis items (MusicAnalysisItem: { aspect, emoji, detail })
  if (isAnalysisItems(data)) {
    return (
      <div className="flex flex-col gap-3">
        {data.map((item, i) => (
          <GlassCard key={i} variant="interactive">
            <div className="flex gap-3">
              {item.emoji && <span className="text-xl" aria-hidden="true">{item.emoji}</span>}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm">{item.aspect}</h4>
                <p className="text-sm text-muted-foreground mt-1">{item.detail}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }

  // Handle array of tips
  if (isTips(data)) {
    return (
      <div className="flex flex-col gap-2">
        {data.map((tip, i) => (
          <GlassCard key={i}>
            <CalloutBlock style={mapTipType(tip.type)} text={tip.text} />
          </GlassCard>
        ))}
      </div>
    );
  }

  // Handle array of specs
  if (isSpecs(data)) {
    return (
      <GlassCard>
        <KeyValueRow block={{ blockId: `specs-${tabId}`, type: 'key_value', variant: 'specs', items: data.map(s => ({ key: s.key, value: s.value })) }} />
      </GlassCard>
    );
  }

  // Handle array of quotes
  if (isQuotes(data)) {
    return (
      <div className="flex flex-col gap-3">
        {data.map((quote, i) => (
          <GlassCard key={i}>
            <QuoteBlock block={{ blockId: `quote-${i}`, type: 'quote', text: quote.text, attribution: quote.speaker, variant: 'speaker' }} />
          </GlassCard>
        ))}
      </div>
    );
  }

  // Handle array of strings (takeaways, pros, cons, etc.)
  if (isStringArray(data)) {
    return (
      <GlassCard>
        <ListBlock items={data} />
      </GlassCard>
    );
  }

  // Handle plain string (analysis, lyrics text, etc.)
  if (typeof data === 'string') {
    return (
      <GlassCard>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{data}</p>
      </GlassCard>
    );
  }

  // Handle generic object — render as key-value pairs
  if (typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([, v]) => v != null && typeof v !== 'object'
    );
    if (entries.length > 0) {
      return (
        <GlassCard>
          <KeyValueRow
            block={{
              blockId: `kv-${tabId}`,
              type: 'key_value',
              variant: 'info',
              items: entries.map(([key, value]) => ({ key, value: String(value) })),
            }}
          />
        </GlassCard>
      );
    }
  }

  return null;
});

// ── Type guards ──

function isKeyPoints(data: unknown): data is KeyPointItem[] {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] != null && 'emoji' in data[0] && 'title' in data[0] && 'detail' in data[0];
}

function isAnalysisItems(data: unknown): data is Array<{ aspect: string; emoji?: string; detail: string }> {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] != null && 'aspect' in data[0] && 'detail' in data[0];
}

function isTips(data: unknown): data is TipItem[] {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] != null && 'type' in data[0] && 'text' in data[0] && !('emoji' in data[0]);
}

function isSpecs(data: unknown): data is ReviewSpec[] {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] != null && 'key' in data[0] && 'value' in data[0];
}

function isQuotes(data: unknown): data is NarrativeQuote[] {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] != null && 'text' in data[0] && 'speaker' in data[0];
}

function isStringArray(data: unknown): data is string[] {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'string';
}

function mapTipType(type: string): 'tip' | 'warning' | 'note' {
  if (type === 'warning' || type === 'safety') return 'warning';
  if (type === 'chef_tip' || type === 'tip') return 'tip';
  return 'note';
}
