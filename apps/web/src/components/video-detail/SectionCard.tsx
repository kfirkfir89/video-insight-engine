import { Play } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Section } from "@vie/types";

interface SectionCardProps {
  section: Section;
  onPlay: () => void;
}

export function SectionCard({ section, onPlay }: SectionCardProps) {
  // Check if this is a creator chapter with dual titles
  const hasCreatorChapter = section.isCreatorChapter && section.originalTitle;

  return (
    <Card
      id={`section-${section.id}`}
      data-slot="section-card"
      className="group transition-all hover:shadow-md"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        {hasCreatorChapter ? (
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight">{section.originalTitle}</h3>
            {section.generatedTitle && (
              <p className="text-sm text-muted-foreground mt-1">{section.generatedTitle}</p>
            )}
          </div>
        ) : (
          <h3 className="font-semibold text-lg leading-tight">{section.title}</h3>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onPlay}
          className="gap-1.5 text-primary hover:bg-primary/10 shrink-0"
          aria-label={`Play from ${section.timestamp}`}
        >
          <Play className="h-4 w-4" />
          <span className="font-mono text-xs">{section.timestamp}</span>
        </Button>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-muted-foreground mb-4 leading-relaxed">
          {section.summary}
        </p>

        {section.bullets && section.bullets.length > 0 && (
          <ul className="space-y-2">
            {section.bullets.map((bullet, index) => (
              <li key={index} className="flex gap-2.5 text-sm">
                <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
                <span className="text-muted-foreground">{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
