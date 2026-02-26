/**
 * Block Showcase Component - Dev Only
 *
 * Displays all 31 content blocks with live previews and JSON toggle.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('BlockShowcase should not be imported in production');
}

import { useState } from 'react';
import { ChevronDown, ChevronRight, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContentBlockRenderer } from '@/components/video-detail/ContentBlockRenderer';
import { sampleBlocks } from '@/lib/dev/mock-blocks';
import type { ContentBlock } from '@vie/types';

interface BlockGroup {
  name: string;
  description: string;
  blocks: { key: string; label: string; block: ContentBlock }[];
}

const blockGroups: BlockGroup[] = [
  {
    name: 'Universal Blocks',
    description: '12 general-purpose blocks usable in any category',
    blocks: [
      { key: 'paragraph', label: 'Paragraph', block: sampleBlocks.paragraph },
      { key: 'bullets', label: 'Bullets', block: sampleBlocks.bullets },
      { key: 'numbered', label: 'Numbered', block: sampleBlocks.numbered },
      { key: 'do_dont', label: 'Do/Don\'t', block: sampleBlocks.do_dont },
      { key: 'example', label: 'Example', block: sampleBlocks.example },
      { key: 'callout_tip', label: 'Callout (Tip)', block: sampleBlocks.callout_tip },
      { key: 'callout_warning', label: 'Callout (Warning)', block: sampleBlocks.callout_warning },
      { key: 'callout_note', label: 'Callout (Note)', block: sampleBlocks.callout_note },
      { key: 'definition', label: 'Definition', block: sampleBlocks.definition },
      { key: 'keyvalue', label: 'Key-Value', block: sampleBlocks.keyvalue },
      { key: 'comparison', label: 'Comparison', block: sampleBlocks.comparison },
      { key: 'timestamp', label: 'Timestamp', block: sampleBlocks.timestamp },
      { key: 'quote', label: 'Quote', block: sampleBlocks.quote },
      { key: 'statistic', label: 'Statistic', block: sampleBlocks.statistic },
    ],
  },
  {
    name: 'New Universal Blocks',
    description: '3 additional universal blocks added in V2.1',
    blocks: [
      { key: 'transcript', label: 'Transcript', block: sampleBlocks.transcript },
      { key: 'timeline', label: 'Timeline', block: sampleBlocks.timeline },
      { key: 'tool_list', label: 'Tool List', block: sampleBlocks.tool_list },
    ],
  },
  {
    name: 'Cooking Blocks',
    description: '3 blocks for recipe content',
    blocks: [
      { key: 'ingredient', label: 'Ingredient', block: sampleBlocks.ingredient },
      { key: 'step', label: 'Step', block: sampleBlocks.step },
      { key: 'nutrition', label: 'Nutrition', block: sampleBlocks.nutrition },
    ],
  },
  {
    name: 'Coding Blocks',
    description: '3 blocks for programming tutorials',
    blocks: [
      { key: 'code', label: 'Code', block: sampleBlocks.code },
      { key: 'terminal', label: 'Terminal', block: sampleBlocks.terminal },
      { key: 'file_tree', label: 'File Tree', block: sampleBlocks.file_tree },
    ],
  },
  {
    name: 'Travel Blocks',
    description: '3 blocks for travel guides',
    blocks: [
      { key: 'location', label: 'Location', block: sampleBlocks.location },
      { key: 'itinerary', label: 'Itinerary', block: sampleBlocks.itinerary },
      { key: 'cost', label: 'Cost', block: sampleBlocks.cost },
    ],
  },
  {
    name: 'Review Blocks',
    description: '3 blocks for product/service reviews',
    blocks: [
      { key: 'pro_con', label: 'Pro/Con', block: sampleBlocks.pro_con },
      { key: 'rating', label: 'Rating', block: sampleBlocks.rating },
      { key: 'verdict', label: 'Verdict', block: sampleBlocks.verdict },
    ],
  },
  {
    name: 'Fitness Blocks',
    description: '2 blocks for workout content',
    blocks: [
      { key: 'exercise', label: 'Exercise', block: sampleBlocks.exercise },
      { key: 'workout_timer', label: 'Workout Timer', block: sampleBlocks.workout_timer },
    ],
  },
  {
    name: 'Education Blocks',
    description: '2 blocks for educational content',
    blocks: [
      { key: 'quiz', label: 'Quiz', block: sampleBlocks.quiz },
      { key: 'formula', label: 'Formula', block: sampleBlocks.formula },
    ],
  },
  {
    name: 'Podcast Blocks',
    description: '1 block for podcast content',
    blocks: [
      { key: 'guest', label: 'Guest', block: sampleBlocks.guest },
    ],
  },
  {
    name: 'Quality Blocks',
    description: '2 blocks for output accuracy',
    blocks: [
      { key: 'problem_solution', label: 'Problem/Solution', block: sampleBlocks.problem_solution },
      { key: 'visual', label: 'Visual', block: sampleBlocks.visual },
    ],
  },
  {
    name: 'Generic Blocks',
    description: '1 block for tabular data',
    blocks: [
      { key: 'table', label: 'Table', block: sampleBlocks.table },
    ],
  },
  {
    name: 'Special Callouts',
    description: 'Additional callout variants',
    blocks: [
      { key: 'callout_chef_tip', label: 'Chef Tip', block: sampleBlocks.callout_chef_tip },
      { key: 'callout_security', label: 'Security', block: sampleBlocks.callout_security },
    ],
  },
];

function BlockCard({ label, block }: { label: string; block: ContentBlock }) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2 bg-muted/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {block.type}
          </code>
        </div>
        <button
          onClick={() => setShowJson(!showJson)}
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
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

      {/* Preview */}
      <div className="p-4">
        <ContentBlockRenderer block={block} />
      </div>

      {/* JSON View */}
      {showJson && (
        <div className="border-t bg-muted/30 p-4">
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(block, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function BlockGroupSection({ group }: { group: BlockGroup }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <h3 className="text-lg font-semibold">{group.name}</h3>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {group.blocks.length}
        </span>
      </button>

      {isExpanded && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {group.blocks.map(({ key, label, block }) => (
            <BlockCard key={key} label={label} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BlockShowcase() {
  const [filter, setFilter] = useState('');
  const totalBlocks = blockGroups.reduce((sum, g) => sum + g.blocks.length, 0);

  const filteredGroups = filter
    ? blockGroups
        .map((group) => ({
          ...group,
          blocks: group.blocks.filter(
            (b) =>
              b.label.toLowerCase().includes(filter.toLowerCase()) ||
              b.block.type.toLowerCase().includes(filter.toLowerCase())
          ),
        }))
        .filter((g) => g.blocks.length > 0)
    : blockGroups;

  const filteredCount = filteredGroups.reduce((sum, g) => sum + g.blocks.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Content Blocks</h2>
        <p className="text-muted-foreground">
          All {totalBlocks} content block types with live previews.
          Click JSON to see the block data structure.
        </p>
      </div>

      {/* Search/Filter */}
      <div className="relative">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter blocks by name or type..."
          className="w-full rounded-xl border border-border/40 bg-background/80 backdrop-blur-sm px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          aria-label="Filter blocks"
        />
        {filter && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {filteredCount} of {totalBlocks}
          </span>
        )}
      </div>

      {/* Block count summary */}
      <div className="flex flex-wrap gap-2">
        {blockGroups.map((group) => (
          <span
            key={group.name}
            className="inline-flex items-center rounded-full bg-muted/60 backdrop-blur-sm border border-border/30 px-3 py-1 text-sm"
          >
            {group.name}
            <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-xs font-medium">
              {group.blocks.length}
            </span>
          </span>
        ))}
      </div>

      {/* Block groups */}
      <div className="space-y-8">
        {filteredGroups.map((group) => (
          <BlockGroupSection key={group.name} group={group} />
        ))}
        {filteredGroups.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No blocks match "{filter}"</p>
        )}
      </div>
    </div>
  );
}
