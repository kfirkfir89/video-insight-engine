/**
 * Design System Page - Dev Only
 *
 * Showcases all design tokens, blocks, and views in one place.
 * Tab-based section switching for fast navigation.
 * Tree-shaken from production builds via conditional lazy loading.
 */

// Production guard - REQUIRED
if (!import.meta.env.DEV) {
  throw new Error('DesignSystemPage should not be imported in production');
}

import { useState } from 'react';
import { Palette, Type, Ruler, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

import { ColorPalette } from '@/components/dev/design-system/ColorPalette';
import { Typography } from '@/components/dev/design-system/Typography';
import { SpacingScale } from '@/components/dev/design-system/SpacingScale';
import { BlockShowcase } from '@/components/dev/design-system/BlockShowcase';

type Section = 'colors' | 'typography' | 'spacing' | 'blocks';

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'colors', label: 'Colors', icon: <Palette className="h-4 w-4" /> },
  { id: 'typography', label: 'Typography', icon: <Type className="h-4 w-4" /> },
  { id: 'spacing', label: 'Spacing', icon: <Ruler className="h-4 w-4" /> },
  { id: 'blocks', label: 'Blocks', icon: <LayoutGrid className="h-4 w-4" /> },
];

function SectionContent({ section }: { section: Section }) {
  switch (section) {
    case 'colors':
      return <ColorPalette />;
    case 'typography':
      return <Typography />;
    case 'spacing':
      return <SpacingScale />;
    case 'blocks':
      return <BlockShowcase />;
  }
}

export function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState<Section>('colors');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold">Design System</h1>
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              DEV ONLY
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="container py-8 px-4 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <nav className="mb-8 flex gap-1 rounded-lg border border-border/40 bg-muted/30 p-1 w-fit" aria-label="Design system sections">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors',
                activeSection === section.id
                  ? 'bg-background text-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-selected={activeSection === section.id}
              role="tab"
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </nav>

        {/* Active Section Content */}
        <main className="min-w-0">
          <SectionContent section={activeSection} />
        </main>
      </div>
    </div>
  );
}
