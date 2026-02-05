/**
 * Video Examples Page - Dev Only
 *
 * Shows complete video pages with mock data for all 10 categories.
 * Tree-shaken from production builds via conditional lazy loading.
 */

// Production guard - REQUIRED
if (!import.meta.env.DEV) {
  throw new Error('VideoExamplesPage should not be imported in production');
}

import { useState } from 'react';
import { VIDEO_CATEGORY_VALUES, type VideoCategory } from '@vie/types';
import { cn } from '@/lib/utils';
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
import { CategoryVideoExample } from '@/components/dev/video-examples/CategoryVideoExample';

const categoryIcons: Record<VideoCategory, React.ReactNode> = {
  cooking: <ChefHat className="h-4 w-4" />,
  coding: <Code className="h-4 w-4" />,
  travel: <Plane className="h-4 w-4" />,
  reviews: <Star className="h-4 w-4" />,
  fitness: <Dumbbell className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  podcast: <Mic className="h-4 w-4" />,
  diy: <Hammer className="h-4 w-4" />,
  gaming: <Gamepad2 className="h-4 w-4" />,
  standard: <FileText className="h-4 w-4" />,
};

const categoryLabels: Record<VideoCategory, string> = {
  cooking: 'Cooking',
  coding: 'Coding',
  travel: 'Travel',
  reviews: 'Reviews',
  fitness: 'Fitness',
  education: 'Education',
  podcast: 'Podcast',
  diy: 'DIY',
  gaming: 'Gaming',
  standard: 'Standard',
};

export function VideoExamplesPage() {
  const [activeCategory, setActiveCategory] = useState<VideoCategory>('cooking');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <h1 className="text-xl font-semibold">Video Examples</h1>
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            DEV ONLY
          </span>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="sticky top-14 z-40 border-b bg-background">
        <div className="container">
          <nav className="flex overflow-x-auto" aria-label="Video categories">
            {VIDEO_CATEGORY_VALUES.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  activeCategory === category
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
                aria-current={activeCategory === category ? 'page' : undefined}
              >
                {categoryIcons[category]}
                {categoryLabels[category]}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Video Example Content */}
      <main className={cn('category-' + activeCategory)}>
        <CategoryVideoExample category={activeCategory} />
      </main>
    </div>
  );
}
