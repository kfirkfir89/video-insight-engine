import { memo, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Lightbulb } from 'lucide-react';
import { useConcepts } from './ConceptsContext';
import type { Concept } from '@vie/types';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?{}()|[\]\\^$]/g, '\\$&');
}

// Word-boundary character class for regex lookahead/lookbehind.
// Uses explicit whitespace/punctuation instead of \b for Unicode (accented char) support.
const BOUNDARY = '[\\s.,;:!?()"\'\\[\\]\\-\\/\\u2013\\u2014]';

interface ConceptHighlighterProps {
  text: string;
}

/**
 * Highlights concept names in text with clickable popovers showing definitions.
 * Uses regex matching with word boundaries that support accented characters.
 * Each popover manages its own open/close state independently.
 */
export const ConceptHighlighter = memo(function ConceptHighlighter({ text }: ConceptHighlighterProps) {
  const concepts = useConcepts();

  // Build regex and concept lookup map from concepts list
  const { regex, conceptMap } = useMemo(() => {
    if (!concepts || concepts.length === 0) {
      return { regex: null, conceptMap: new Map<string, Concept>() };
    }

    // Build map keyed by lowercase name for O(1) lookup
    const map = new Map<string, Concept>();
    for (const c of concepts) {
      if (!c.name) continue;
      const lower = c.name.toLowerCase();
      map.set(lower, c);

      // Extract abbreviation from parentheses: "Search Engine Optimization (SEO)" → "seo"
      const abbrMatch = c.name.match(/\(([^)]+)\)\s*$/);
      if (abbrMatch && abbrMatch[1].length >= 2) {
        const abbr = abbrMatch[1].toLowerCase();
        if (!map.has(abbr)) {
          map.set(abbr, c);
        }
        // Also register the name without the parenthetical
        const baseName = c.name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase();
        if (baseName.length >= 3 && !map.has(baseName)) {
          map.set(baseName, c);
        }
      }

      // Split on " / " separator: "Reputation Lists / Spam Houses" → each part
      if (c.name.includes(' / ')) {
        for (const part of c.name.split(' / ')) {
          const trimmed = part.trim().toLowerCase();
          if (trimmed.length >= 3 && !map.has(trimmed)) {
            map.set(trimmed, c);
          }
        }
      }
    }

    // Generate plural variants for better matching (add 's' only)
    const existingKeys = Array.from(map.keys());
    for (const key of existingKeys) {
      if (key.length < 3) continue;

      // Only add plural form — skip singular derivation to avoid false matches
      // (e.g. "DNS" → "DN", "class" → "clas")
      if (!key.endsWith('s') && !key.endsWith('x') && !key.endsWith('z')) {
        const plural = key + 's';
        if (!map.has(plural)) map.set(plural, map.get(key)!);
      }
    }

    if (map.size === 0) {
      return { regex: null, conceptMap: map };
    }

    // Sort longest-first to match "Pao de Queijo" before "Pao"
    const names = Array.from(map.keys()).sort((a, b) => b.length - a.length);
    const escaped = names.map(escapeRegex);

    const pattern = `(?<=^|${BOUNDARY})(?:${escaped.join('|')})(?=${BOUNDARY}|$)`;

    try {
      return { regex: new RegExp(pattern, 'gi'), conceptMap: map };
    } catch {
      return { regex: null, conceptMap: map };
    }
  }, [concepts]);

  // No concepts or no regex — render plain text
  if (!regex || conceptMap.size === 0) {
    return <>{text}</>;
  }

  // Split text into segments: plain text and matched concepts
  const segments: Array<{ type: 'text' | 'concept'; value: string; concept?: Concept }> = [];
  let lastIndex = 0;

  // Reset regex state for each render
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add preceding plain text
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const matchedText = match[0];
    const concept = conceptMap.get(matchedText.toLowerCase());

    if (concept) {
      segments.push({ type: 'concept', value: matchedText, concept });
    } else {
      segments.push({ type: 'text', value: matchedText });
    }

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  // No matches found — return plain text
  if (segments.length === 1 && segments[0].type === 'text') {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.value}</span>;
        }

        if (!seg.concept) {
          return <span key={i}>{seg.value}</span>;
        }

        const concept = seg.concept;

        return (
          <Popover.Root
            key={`${concept.id}-${i}`}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="group/concept inline-flex items-baseline gap-0.5 cursor-pointer border-b border-primary/40 text-inherit hover:border-primary hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-sm"
                style={{ borderBottomStyle: 'dotted' }}
                aria-label={`Definition: ${concept.name}`}
              >
                {seg.value}
                <Lightbulb className="h-2.5 w-2.5 shrink-0 self-start text-warning/60 group-hover/concept:text-warning transition-colors" aria-hidden="true" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                align="center"
                sideOffset={6}
                collisionPadding={12}
                avoidCollisions
                className="z-50 max-w-xs rounded-lg border border-border bg-popover px-3 py-2 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <p className="text-sm font-semibold text-foreground mb-1">{concept.name}</p>
                {concept.definition && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{concept.definition}</p>
                )}
                {concept.timestamp && (
                  <p className="text-xs text-muted-foreground/60 mt-1 font-mono">{concept.timestamp}</p>
                )}
                <Popover.Arrow className="fill-border" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        );
      })}
    </>
  );
});
