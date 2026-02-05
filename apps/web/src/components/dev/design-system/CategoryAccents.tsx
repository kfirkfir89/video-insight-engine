/**
 * Category Accents Component - Dev Only
 *
 * Displays all 10 category accent colors with their CSS variables.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('CategoryAccents should not be imported in production');
}

import type { VideoCategory } from '@vie/types';
import {
  ChefHat,
  Code,
  Plane,
  Star,
  Dumbbell,
  GraduationCap,
  Mic,
  Hammer,
  Gamepad2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryInfo {
  category: VideoCategory;
  label: string;
  icon: React.ReactNode;
  accentHex: string;
}

const categories: CategoryInfo[] = [
  { category: 'cooking', label: 'Cooking', icon: <ChefHat className="h-5 w-5" />, accentHex: '#FF6B35' },
  { category: 'coding', label: 'Coding', icon: <Code className="h-5 w-5" />, accentHex: '#22D3EE' },
  { category: 'travel', label: 'Travel', icon: <Plane className="h-5 w-5" />, accentHex: '#10B981' },
  { category: 'reviews', label: 'Reviews', icon: <Star className="h-5 w-5" />, accentHex: '#F59E0B' },
  { category: 'fitness', label: 'Fitness', icon: <Dumbbell className="h-5 w-5" />, accentHex: '#EF4444' },
  { category: 'education', label: 'Education', icon: <GraduationCap className="h-5 w-5" />, accentHex: '#8B5CF6' },
  { category: 'podcast', label: 'Podcast', icon: <Mic className="h-5 w-5" />, accentHex: '#EC4899' },
  { category: 'diy', label: 'DIY', icon: <Hammer className="h-5 w-5" />, accentHex: '#D97706' },
  { category: 'gaming', label: 'Gaming', icon: <Gamepad2 className="h-5 w-5" />, accentHex: '#6366F1' },
  { category: 'standard', label: 'Standard', icon: <FileText className="h-5 w-5" />, accentHex: '#6B7280' },
];

function CategoryCard({ info }: { info: CategoryInfo }) {
  return (
    <div className={cn('category-' + info.category, 'rounded-lg border overflow-hidden')}>
      {/* Accent Header */}
      <div
        className="p-4 flex items-center gap-3"
        style={{ backgroundColor: 'var(--category-accent-soft)' }}
      >
        <span style={{ color: 'var(--category-accent)' }}>{info.icon}</span>
        <span className="font-semibold" style={{ color: 'var(--category-accent)' }}>
          {info.label}
        </span>
      </div>

      {/* Color Swatches */}
      <div className="p-4 space-y-3">
        {/* Accent */}
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded border"
            style={{ backgroundColor: 'var(--category-accent)' }}
          />
          <div>
            <p className="text-sm font-medium">--category-accent</p>
            <p className="text-xs text-muted-foreground font-mono">{info.accentHex}</p>
          </div>
        </div>

        {/* Accent Soft */}
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded border"
            style={{ backgroundColor: 'var(--category-accent-soft)' }}
          />
          <div>
            <p className="text-sm font-medium">--category-accent-soft</p>
            <p className="text-xs text-muted-foreground">12% opacity</p>
          </div>
        </div>

        {/* Surface */}
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded border"
            style={{ backgroundColor: 'var(--category-surface)' }}
          />
          <div>
            <p className="text-sm font-medium">--category-surface</p>
            <p className="text-xs text-muted-foreground">Background tint</p>
          </div>
        </div>
      </div>

      {/* Usage Example */}
      <div className="border-t p-4" style={{ backgroundColor: 'var(--category-surface)' }}>
        <p className="text-sm" style={{ color: 'var(--category-accent)' }}>
          Sample text with accent color
        </p>
      </div>
    </div>
  );
}

export function CategoryAccents() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Category Accents</h2>
        <p className="text-muted-foreground">
          Category-specific colors for theming video content by type.
          Each category provides accent, soft, and surface variants.
        </p>
      </div>

      {/* Category Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {categories.map((info) => (
          <CategoryCard key={info.category} info={info} />
        ))}
      </div>

      {/* Usage Instructions */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <h3 className="font-semibold mb-2">Usage</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Apply the category class to a container element to activate category colors:
        </p>
        <pre className="bg-card rounded p-3 text-sm font-mono overflow-x-auto">
{`<div className="category-cooking">
  <span style={{ color: 'var(--category-accent)' }}>Accent text</span>
  <div style={{ backgroundColor: 'var(--category-surface)' }}>Surface bg</div>
</div>`}
        </pre>
      </div>

      {/* All Categories Inline */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">All Categories (Badges)</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((info) => (
            <span
              key={info.category}
              className={cn(
                'category-' + info.category,
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1'
              )}
              style={{
                backgroundColor: 'var(--category-accent-soft)',
                color: 'var(--category-accent)',
              }}
            >
              {info.icon}
              <span className="text-sm font-medium">{info.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
