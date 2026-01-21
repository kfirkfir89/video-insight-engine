import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Concept } from "@vie/types";

interface ConceptsGridProps {
  concepts: Concept[];
  title?: string;
}

export const ConceptsGrid = memo(function ConceptsGrid({ concepts, title = "Concepts" }: ConceptsGridProps) {
  if (concepts.length === 0) return null;

  return (
    <Card data-slot="concepts-grid">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {concepts.map((concept) => (
            <div
              key={concept.id}
              className="p-4 bg-muted/50 rounded-lg border border-border/50 hover:border-border transition-colors"
            >
              <h4 className="font-medium text-sm mb-1">{concept.name}</h4>
              {concept.definition && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {concept.definition}
                </p>
              )}
              {concept.timestamp && (
                <span className="inline-block mt-2 text-xs text-primary font-mono">
                  {concept.timestamp}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
