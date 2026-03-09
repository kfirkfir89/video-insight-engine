import { useState } from 'react';
import type { ProjectGuideOutput } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { cn } from '../../../../lib/utils';

interface ProjectTabsProps {
  data: ProjectGuideOutput;
  activeTab: string;
}

export function ProjectTabs({ data, activeTab }: ProjectTabsProps) {
  switch (activeTab) {
    case 'overview':
      return (
        <div className="flex flex-col gap-4">
          <GlassCard variant="elevated" className="text-center">
            <h3 className="text-lg font-bold">{data.projectName}</h3>
            <div className="flex items-center justify-center gap-4 mt-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Difficulty</p>
                <p className={cn(
                  'font-semibold capitalize',
                  data.difficulty === 'beginner' && 'text-green-600 dark:text-green-400',
                  data.difficulty === 'intermediate' && 'text-yellow-600 dark:text-yellow-400',
                  data.difficulty === 'advanced' && 'text-red-600 dark:text-red-400',
                )}>
                  {data.difficulty}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="font-semibold">{data.estimatedTime}</p>
              </div>
              {data.estimatedCost && (
                <div>
                  <p className="text-xs text-muted-foreground">Cost</p>
                  <p className="font-semibold">{data.estimatedCost}</p>
                </div>
              )}
            </div>
          </GlassCard>
          {/* Safety warnings */}
          {data.safetyWarnings.length > 0 && (
            <GlassCard className="border-red-500/20 bg-red-500/5">
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Safety Warnings</h4>
              <ul className="flex flex-col gap-1">
                {data.safetyWarnings.map((warning, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="shrink-0 text-red-500">{'\u26A0\uFE0F'}</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      );

    case 'materials':
      return <MaterialsChecklist materials={data.materials} />;

    case 'tools':
      return (
        <div className="flex flex-col gap-3">
          {data.tools.map((tool, i) => (
            <GlassCard key={i} variant="interactive" className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{tool.name}</span>
                  {tool.required ? (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                      Required
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Optional
                    </span>
                  )}
                </div>
                {tool.alternative && (
                  <span className="text-xs text-muted-foreground">
                    Alt: {tool.alternative}
                  </span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      );

    case 'steps':
      return (
        <div className="flex flex-col gap-3">
          {data.steps.map((step) => (
            <GlassCard key={step.number} variant="interactive">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {step.number}
                </span>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">{step.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.instruction}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {step.duration && (
                      <span className="text-xs text-muted-foreground">{step.duration}</span>
                    )}
                    {step.tips && (
                      <span className="text-xs text-primary/80 italic">{step.tips}</span>
                    )}
                  </div>
                  {step.safetyNote && (
                    <p className="mt-1 rounded-md bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
                      {'\u26A0\uFE0F'} {step.safetyNote}
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      );

    case 'safety':
      return (
        <div className="flex flex-col gap-3">
          {data.safetyWarnings.length > 0 ? (
            data.safetyWarnings.map((warning, i) => (
              <GlassCard key={i} className="border-red-500/20">
                <div className="flex gap-2">
                  <span className="shrink-0 text-lg">{'\u26A0\uFE0F'}</span>
                  <p className="text-sm leading-relaxed">{warning}</p>
                </div>
              </GlassCard>
            ))
          ) : (
            <GlassCard className="text-center py-8">
              <p className="text-sm text-muted-foreground">No specific safety warnings for this project.</p>
            </GlassCard>
          )}
        </div>
      );

    default:
      return null;
  }
}

/** Materials checklist with cost tracking */
function MaterialsChecklist({ materials }: { materials: ProjectGuideOutput['materials'] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggleItem(name: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <GlassCard>
      <h4 className="text-sm font-semibold mb-3">Materials</h4>
      <ul className="flex flex-col gap-2">
        {materials.map((mat, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={checked.has(mat.name)}
              onChange={() => toggleItem(mat.name)}
              className="mt-0.5 h-4 w-4 rounded border-muted-foreground/30 accent-primary"
              aria-label={mat.name}
            />
            <div className={cn(
              'flex-1 min-w-0',
              checked.has(mat.name) && 'line-through text-muted-foreground',
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{mat.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {mat.quantity && <span>{mat.quantity}</span>}
                  {mat.cost && <span className="font-medium">{mat.cost}</span>}
                </div>
              </div>
              {mat.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">{mat.notes}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
