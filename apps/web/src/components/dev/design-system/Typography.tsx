/**
 * Typography Component - Dev Only
 *
 * Displays text scale and font weights.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('Typography should not be imported in production');
}

import { cn } from '@/lib/utils';

interface TextSize {
  name: string;
  className: string;
  pxSize: string;
}

const textSizes: TextSize[] = [
  { name: 'text-xs', className: 'text-xs', pxSize: '12px' },
  { name: 'text-sm', className: 'text-sm', pxSize: '14px' },
  { name: 'text-base', className: 'text-base', pxSize: '16px' },
  { name: 'text-lg', className: 'text-lg', pxSize: '18px' },
  { name: 'text-xl', className: 'text-xl', pxSize: '20px' },
  { name: 'text-2xl', className: 'text-2xl', pxSize: '24px' },
  { name: 'text-3xl', className: 'text-3xl', pxSize: '30px' },
  { name: 'text-4xl', className: 'text-4xl', pxSize: '36px' },
];

interface FontWeight {
  name: string;
  className: string;
  weight: string;
}

const fontWeights: FontWeight[] = [
  { name: 'font-normal', className: 'font-normal', weight: '400' },
  { name: 'font-medium', className: 'font-medium', weight: '500' },
  { name: 'font-semibold', className: 'font-semibold', weight: '600' },
  { name: 'font-bold', className: 'font-bold', weight: '700' },
];

export function Typography() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Typography</h2>
        <p className="text-muted-foreground">
          Text sizes and font weights used in the design system.
        </p>
      </div>

      {/* Text Sizes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Text Sizes</h3>
        <div className="space-y-3 rounded-lg border p-4">
          {textSizes.map((size) => (
            <div key={size.name} className="flex items-baseline gap-4">
              <code className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                {size.name}
              </code>
              <span className="w-16 shrink-0 text-xs text-muted-foreground">{size.pxSize}</span>
              <span className={cn(size.className)}>
                The quick brown fox jumps over the lazy dog.
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Font Weights */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Font Weights</h3>
        <div className="space-y-3 rounded-lg border p-4">
          {fontWeights.map((weight) => (
            <div key={weight.name} className="flex items-baseline gap-4">
              <code className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                {weight.name}
              </code>
              <span className="w-12 shrink-0 text-xs text-muted-foreground">{weight.weight}</span>
              <span className={cn('text-lg', weight.className)}>
                The quick brown fox jumps over the lazy dog.
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Combined Example */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Combined Example</h3>
        <div className="rounded-lg border p-6 space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Heading Level 1</h1>
          <h2 className="text-3xl font-semibold">Heading Level 2</h2>
          <h3 className="text-2xl font-semibold">Heading Level 3</h3>
          <h4 className="text-xl font-medium">Heading Level 4</h4>
          <p className="text-base text-muted-foreground leading-relaxed">
            Body text looks like this. It uses the base font size with muted foreground color
            for improved readability. This is how most paragraph content appears throughout
            the application.
          </p>
          <p className="text-sm text-muted-foreground">
            Small text for captions, timestamps, and secondary information.
          </p>
        </div>
      </div>
    </div>
  );
}
