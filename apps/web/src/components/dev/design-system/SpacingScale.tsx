/**
 * Spacing Scale Component - Dev Only
 *
 * Displays Tailwind spacing tokens with visual examples.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('SpacingScale should not be imported in production');
}

interface SpacingToken {
  name: string;
  value: string;
  pixels: string;
}

const spacingTokens: SpacingToken[] = [
  { name: '0', value: '0', pixels: '0px' },
  { name: '0.5', value: '0.125rem', pixels: '2px' },
  { name: '1', value: '0.25rem', pixels: '4px' },
  { name: '1.5', value: '0.375rem', pixels: '6px' },
  { name: '2', value: '0.5rem', pixels: '8px' },
  { name: '2.5', value: '0.625rem', pixels: '10px' },
  { name: '3', value: '0.75rem', pixels: '12px' },
  { name: '4', value: '1rem', pixels: '16px' },
  { name: '5', value: '1.25rem', pixels: '20px' },
  { name: '6', value: '1.5rem', pixels: '24px' },
  { name: '8', value: '2rem', pixels: '32px' },
  { name: '10', value: '2.5rem', pixels: '40px' },
  { name: '12', value: '3rem', pixels: '48px' },
  { name: '16', value: '4rem', pixels: '64px' },
  { name: '20', value: '5rem', pixels: '80px' },
  { name: '24', value: '6rem', pixels: '96px' },
];

export function SpacingScale() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Spacing Scale</h2>
        <p className="text-muted-foreground">
          Tailwind spacing tokens for consistent margins, padding, and gaps.
        </p>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left text-sm font-medium">Token</th>
              <th className="p-3 text-left text-sm font-medium">Value</th>
              <th className="p-3 text-left text-sm font-medium">Pixels</th>
              <th className="p-3 text-left text-sm font-medium">Visual</th>
            </tr>
          </thead>
          <tbody>
            {spacingTokens.map((token, index) => (
              <tr
                key={token.name}
                className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
              >
                <td className="p-3">
                  <code className="font-mono text-sm text-primary">{token.name}</code>
                </td>
                <td className="p-3">
                  <code className="font-mono text-sm text-muted-foreground">{token.value}</code>
                </td>
                <td className="p-3">
                  <code className="font-mono text-sm text-muted-foreground">{token.pixels}</code>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 bg-primary/60 rounded"
                      style={{ width: token.value === '0' ? '2px' : token.value }}
                      aria-label={`Visual representation of ${token.pixels}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Usage Examples */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Usage Examples</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Padding (p-4)</p>
            <div className="rounded bg-primary/10">
              <div className="bg-primary/20 p-4 rounded">
                <div className="bg-card rounded border p-2 text-sm">Content</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Gap (gap-4)</p>
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded bg-primary/40" />
              <div className="h-10 w-10 rounded bg-primary/40" />
              <div className="h-10 w-10 rounded bg-primary/40" />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Margin (m-2)</p>
            <div className="rounded bg-muted">
              <div className="bg-primary/40 m-2 h-8 rounded" />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Space-y (space-y-2)</p>
            <div className="space-y-2">
              <div className="h-6 rounded bg-primary/40" />
              <div className="h-6 rounded bg-primary/40" />
              <div className="h-6 rounded bg-primary/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
