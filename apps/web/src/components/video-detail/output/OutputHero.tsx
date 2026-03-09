import { cn } from '../../../lib/utils';
import type { OutputType } from '@vie/types';
import { OUTPUT_GRADIENT_VAR } from './output-constants';

interface OutputHeroProps {
  outputType: OutputType;
  title: string;
  emoji: string;
  meta?: { label: string; value: string }[];
  className?: string;
}

export function OutputHero({ outputType, title, emoji, meta, className }: OutputHeroProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl p-6 md:p-8', className)}
      style={{ background: OUTPUT_GRADIENT_VAR[outputType] }}
    >
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 animate-[float_4s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5 animate-[float_5s_ease-in-out_infinite_1s]" />

      <div className="relative z-10 flex flex-col gap-3">
        <span className="text-5xl" role="img" aria-label={outputType.replace('_', ' ')}>
          {emoji}
        </span>
        <h1 className="text-xl font-bold text-white md:text-2xl leading-tight">{title}</h1>
        {meta && meta.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {meta.map((m) => (
              <span
                key={m.label}
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white/90"
              >
                {m.label}: {m.value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
