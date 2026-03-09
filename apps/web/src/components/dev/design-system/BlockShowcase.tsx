/**
 * Block Showcase Component - Dev Only
 *
 * Flat grid layout with variant tabs and category filter pills.
 * Each unique component renders once with switchable variants.
 * Unified output system — no V1/V2 distinction.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('BlockShowcase should not be imported in production');
}

import { useState, useMemo } from 'react';
import { Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContentBlockRenderer } from '@/components/video-detail/ContentBlockRenderer';
import { showcaseEntries, type ShowcaseEntry } from '@/lib/dev/mock-blocks';

// ─────────────────────────────────────────────────────
// VariantTabBar — small pills to switch between variants
// ─────────────────────────────────────────────────────

function VariantTabBar({
  variants,
  activeIndex,
  onChange,
}: {
  variants: ShowcaseEntry['variants'];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  if (variants.length <= 1) return null;

  return (
    <div className="flex gap-1 overflow-x-auto rounded-md bg-muted/50 p-1">
      {variants.map((v, i) => (
        <button
          key={v.name}
          onClick={() => onChange(i)}
          className={cn(
            'whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors',
            i === activeIndex
              ? 'bg-background text-foreground font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v.name}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// BlockCard — header + variant tabs + preview + JSON toggle
// ─────────────────────────────────────────────────────

function BlockCard({ entry }: { entry: ShowcaseEntry }) {
  const [activeVariant, setActiveVariant] = useState(0);
  const [showJson, setShowJson] = useState(false);

  const currentBlock = entry.variants[activeVariant].block;

  return (
    <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{entry.label}</span>
            <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {entry.type}
            </code>
            <span className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
              {entry.category}
            </span>
            {entry.variants.length > 1 && (
              <span className="text-[10px] text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded font-medium">
                {entry.variants.length} variants
              </span>
            )}
          </div>
          <button
            onClick={() => setShowJson(!showJson)}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors shrink-0',
              showJson
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-expanded={showJson}
            aria-label={showJson ? 'Hide JSON' : 'Show JSON'}
          >
            <Code className="h-3 w-3" />
            JSON
          </button>
        </div>

        {/* Variant tabs */}
        <VariantTabBar
          variants={entry.variants}
          activeIndex={activeVariant}
          onChange={setActiveVariant}
        />
      </div>

      {/* Block preview */}
      <div className="p-4">
        <ContentBlockRenderer block={currentBlock} />
      </div>

      {/* JSON panel */}
      {showJson && (
        <div className="border-t bg-muted/30 p-4">
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(currentBlock, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// CategoryPills — filter by category
// ─────────────────────────────────────────────────────

function CategoryPills({
  categories,
  active,
  onChange,
}: {
  categories: { name: string; count: number }[];
  active: string | null;
  onChange: (category: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs transition-colors',
          active === null
            ? 'bg-foreground text-background font-medium'
            : 'bg-muted text-muted-foreground hover:text-foreground'
        )}
      >
        All ({showcaseEntries.length})
      </button>
      {categories.map((cat) => (
        <button
          key={cat.name}
          onClick={() => onChange(active === cat.name ? null : cat.name)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs transition-colors',
            active === cat.name
              ? 'bg-foreground text-background font-medium'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          {cat.name} ({cat.count})
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// BlockShowcase — main export
// ─────────────────────────────────────────────────────

export function BlockShowcase() {
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Derive categories with counts
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of showcaseEntries) {
      map.set(entry.category, (map.get(entry.category) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, []);

  // Filter entries
  const filtered = useMemo(() => {
    let entries = showcaseEntries;

    if (activeCategory) {
      entries = entries.filter((e) => e.category === activeCategory);
    }

    if (filter) {
      const q = filter.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }

    return entries;
  }, [filter, activeCategory]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Content Blocks</h2>
        <p className="text-sm text-muted-foreground">
          {showcaseEntries.length} unique components. Each renders via ContentBlockRenderer with switchable variants.
        </p>
      </div>

      {/* Category filter pills */}
      <CategoryPills
        categories={categories}
        active={activeCategory}
        onChange={setActiveCategory}
      />

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter blocks..."
          className="w-full rounded-lg border border-border/40 bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter blocks"
        />
        {filter && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {filtered.length}/{showcaseEntries.length}
          </span>
        )}
      </div>

      {/* Flat grid */}
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {filtered.map((entry) => (
          <BlockCard key={entry.label} entry={entry} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No blocks match &ldquo;{filter}&rdquo;
        </p>
      )}
    </div>
  );
}
