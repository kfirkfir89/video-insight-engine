/**
 * Design System Page - Dev Only
 *
 * Showcases all design tokens, blocks, and views in one place.
 * Tree-shaken from production builds via conditional lazy loading.
 */

// Production guard - REQUIRED
if (!import.meta.env.DEV) {
  throw new Error('DesignSystemPage should not be imported in production');
}

import { useState } from 'react';
import { Palette, Type, Ruler, Activity, Layers, LayoutGrid, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// Components will be imported as they're built
import { ColorPalette } from '@/components/dev/design-system/ColorPalette';
import { Typography } from '@/components/dev/design-system/Typography';
import { SpacingScale } from '@/components/dev/design-system/SpacingScale';
import { StatusIndicators } from '@/components/dev/design-system/StatusIndicators';
import { CategoryAccents } from '@/components/dev/design-system/CategoryAccents';
import { BlockShowcase } from '@/components/dev/design-system/BlockShowcase';
import { ViewShowcase } from '@/components/dev/design-system/ViewShowcase';

type Section = 'colors' | 'typography' | 'spacing' | 'status' | 'categories' | 'blocks' | 'views';

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'colors', label: 'Colors', icon: <Palette className="h-4 w-4" /> },
  { id: 'typography', label: 'Typography', icon: <Type className="h-4 w-4" /> },
  { id: 'spacing', label: 'Spacing', icon: <Ruler className="h-4 w-4" /> },
  { id: 'status', label: 'Status', icon: <Activity className="h-4 w-4" /> },
  { id: 'categories', label: 'Categories', icon: <Layers className="h-4 w-4" /> },
  { id: 'blocks', label: 'Blocks', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'views', label: 'Views', icon: <Eye className="h-4 w-4" /> },
];

export function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState<Section>('colors');

  const scrollToSection = (sectionId: Section) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <h1 className="text-xl font-semibold">Design System</h1>
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            DEV ONLY
          </span>
        </div>
      </header>

      <div className="container flex gap-8 py-8">
        {/* Sidebar Navigation */}
        <nav className="sticky top-20 h-fit w-48 shrink-0" aria-label="Design system sections">
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    activeSection === section.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {section.icon}
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content */}
        <main className="flex-1 space-y-16">
          <section id="colors">
            <ColorPalette />
          </section>

          <section id="typography">
            <Typography />
          </section>

          <section id="spacing">
            <SpacingScale />
          </section>

          <section id="status">
            <StatusIndicators />
          </section>

          <section id="categories">
            <CategoryAccents />
          </section>

          <section id="blocks">
            <BlockShowcase />
          </section>

          <section id="views">
            <ViewShowcase />
          </section>
        </main>
      </div>

      {/* Back to top button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-opacity hover:bg-primary/90"
        aria-label="Back to top"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
