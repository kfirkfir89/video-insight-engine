import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, ArrowUpDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, FadeIn, Badge, ExpandableCard } from '@/components/vie';
import { Button } from '@/components/ui/button';


type InfoGridMode = 'key_value' | 'table' | 'tag_cloud';

interface InfoGridItem {
  key: string;
  value: string;
}

interface InfoGridSection {
  label: string;
  indices: number[];
}

interface InfoGridInteractiveProps {
  items: InfoGridItem[];
  mode?: InfoGridMode;
  sections?: InfoGridSection[];
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

type SortDir = 'asc' | 'desc' | null;

export const InfoGridInteractive = memo(function InfoGridInteractive({
  items,
  mode = 'key_value',
  sections,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: InfoGridInteractiveProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const showSearch = items.length > 8;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items.map((item, i) => ({ ...item, originalIndex: i }));
    const q = searchQuery.toLowerCase();
    return items
      .map((item, i) => ({ ...item, originalIndex: i }))
      .filter((item) => item.key.toLowerCase().includes(q) || item.value.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = a.key.localeCompare(b.key);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortDir]);

  const toggleSort = useCallback(() => {
    setSortDir((prev) => (prev === null ? 'asc' : prev === 'asc' ? 'desc' : null));
  }, []);

  const handleBulkCopy = useCallback(async () => {
    const text = sorted.map((item) => `${item.key}: ${item.value}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedAll(false), 1500);
    } catch { /* clipboard API may fail in insecure contexts */ }
  }, [sorted]);

  if (items.length === 0) return null;

  const renderGridCell = (item: { key: string; value: string; originalIndex: number }, displayIndex: number) => (
    <FadeIn key={item.originalIndex} index={displayIndex}>
      <GlassCard variant="outlined" className="h-full p-3 space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 block">
          {item.key}
        </span>
        <p className="text-sm font-medium leading-snug break-words">
          {item.value}
        </p>
      </GlassCard>
    </FadeIn>
  );

  const renderGrid = (gridItems: typeof sorted) => (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
      {gridItems.map((item, i) => renderGridCell(item, i))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search + Sort + Bulk copy toolbar */}
      {(showSearch || items.length > 3) && (
        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter..."
                aria-label="Filter results"
                className="w-full ps-8 pe-3 py-1.5 text-sm rounded-lg border border-border/50 bg-muted/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
              />
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={toggleSort} aria-label="Sort alphabetically">
            <ArrowUpDown className={cn('h-3.5 w-3.5', sortDir && 'text-primary')} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleBulkCopy} aria-label="Copy all">
            {copiedAll
              ? <Check className="h-3.5 w-3.5 text-success" />
              : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </Button>
        </div>
      )}

      {/* No results */}
      {sorted.length === 0 && searchQuery && (
        <p className="text-sm text-muted-foreground text-center py-4">No items match &ldquo;{searchQuery}&rdquo;</p>
      )}

      {/* Sectioned layout */}
      {sections && sections.length > 0 ? (
        sections.map((section) => {
          const sectionItems = sorted.filter((item) => section.indices.includes(item.originalIndex));
          if (sectionItems.length === 0) return null;
          return (
            <ExpandableCard
              key={section.label}
              defaultExpanded
              header={
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{section.label}</span>
                  <Badge variant="muted">{sectionItems.length}</Badge>
                </div>
              }
            >
              {renderGrid(sectionItems)}
            </ExpandableCard>
          );
        })
      ) : (
        <>
          {/* CSS grid cards for key_value mode */}
          {mode === 'key_value' && renderGrid(sorted)}

          {mode === 'table' && (
            <GlassCard variant="default" className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-start px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Key</th>
                    <th className="text-start px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr
                      key={item.originalIndex}
                      className="border-b border-border/20 last:border-0 even:bg-muted/10 hover:bg-primary/5 transition-colors"
                    >
                      <td className="px-4 py-1.5 font-medium">{item.key}</td>
                      <td className="px-4 py-1.5 text-muted-foreground">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}

          {mode === 'tag_cloud' && (
            <GlassCard>
              <div className="flex flex-wrap gap-2">
                {sorted.map((item, index) => (
                  <FadeIn key={item.originalIndex} index={index}>
                    <Badge variant="default" className="text-xs">
                      {item.key}{item.value ? `: ${item.value}` : ''}
                    </Badge>
                  </FadeIn>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}

    </div>
  );
});
