import type { CodeWalkthroughOutput, EnrichmentData } from '@vie/types';
import { GlassCard } from '../GlassCard';

interface CodeTabsProps {
  data: CodeWalkthroughOutput;
  enrichment?: EnrichmentData;
  activeTab: string;
}

export function CodeTabs({ data, enrichment, activeTab }: CodeTabsProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="flex flex-col gap-4">
          {/* Language & framework badges */}
          <GlassCard>
            <h4 className="text-sm font-semibold mb-3">Technologies</h4>
            <div className="flex flex-wrap gap-2">
              {data.languages.map((lang) => (
                <span key={lang} className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                  {lang}
                </span>
              ))}
              {data.frameworks.map((fw) => (
                <span key={fw} className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-400">
                  {fw}
                </span>
              ))}
            </div>
          </GlassCard>
          {/* Key concepts */}
          {data.concepts.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Key Concepts</h4>
              <div className="flex flex-wrap gap-2">
                {data.concepts.map((concept) => (
                  <span key={concept} className="rounded-full bg-muted px-3 py-1 text-xs">
                    {concept}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      );

    case 'setup':
      return (
        <div className="flex flex-col gap-4">
          {/* Commands */}
          {data.setup.commands.length > 0 && (
            <GlassCard className="bg-zinc-950 dark:bg-zinc-900 text-green-400">
              <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Terminal</h4>
              <div className="flex flex-col gap-1 font-mono text-sm">
                {data.setup.commands.map((cmd, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-zinc-500 select-none">$</span>
                    <code>{cmd}</code>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
          {/* Dependencies */}
          {data.setup.dependencies.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Dependencies</h4>
              <div className="flex flex-wrap gap-2">
                {data.setup.dependencies.map((dep, i) => (
                  <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs font-mono">
                    {dep.name}{dep.version ? `@${dep.version}` : ''}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}
          {/* Environment Variables */}
          {data.setup.envVars.length > 0 && (
            <GlassCard>
              <h4 className="text-sm font-semibold mb-3">Environment Variables</h4>
              <div className="flex flex-col gap-2">
                {data.setup.envVars.map((env, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <code className="text-xs font-mono font-semibold">{env.name}</code>
                    <p className="text-xs text-muted-foreground">{env.description}</p>
                    {env.example && (
                      <p className="text-xs text-muted-foreground/60">Example: {env.example}</p>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      );

    case 'code':
      return (
        <div className="flex flex-col gap-4">
          {data.snippets.map((snippet, i) => (
            <GlassCard key={i}>
              <div className="flex flex-col gap-2">
                {snippet.filename && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{snippet.filename}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{snippet.language}</span>
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4">
                  <pre className="text-sm text-zinc-200">
                    <code>{snippet.code}</code>
                  </pre>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{snippet.explanation}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      );

    case 'patterns':
      return (
        <div className="flex flex-col gap-4">
          {data.patterns.map((pattern, i) => (
            <GlassCard key={i}>
              <h4 className="text-sm font-semibold mb-3">{pattern.title}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Do example */}
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                  <span className="mb-1 block text-xs font-semibold text-green-600 dark:text-green-400">Do</span>
                  <pre className="overflow-x-auto text-xs text-green-800 dark:text-green-300">
                    <code>{pattern.doExample}</code>
                  </pre>
                </div>
                {/* Don't example */}
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <span className="mb-1 block text-xs font-semibold text-red-600 dark:text-red-400">Don't</span>
                  <pre className="overflow-x-auto text-xs text-red-800 dark:text-red-300">
                    <code>{pattern.dontExample}</code>
                  </pre>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{pattern.explanation}</p>
            </GlassCard>
          ))}
        </div>
      );

    case 'cheat_sheet': {
      const cheatItems = enrichment?.cheatSheet ?? data.cheatSheet;
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {cheatItems.map((item, i) => (
            <GlassCard key={i} variant="interactive">
              <h4 className="text-sm font-semibold mb-1">{item.title}</h4>
              <div className="overflow-x-auto rounded-md bg-zinc-950 dark:bg-zinc-900 p-2 mb-2">
                <code className="text-xs text-zinc-200">{item.code}</code>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </GlassCard>
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}
