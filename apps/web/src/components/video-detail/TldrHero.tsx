import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TldrHeroProps {
  tldr: string;
}

export function TldrHero({ tldr }: TldrHeroProps) {
  return (
    <Card
      data-slot="tldr-hero"
      className="relative overflow-hidden border-0 bg-gradient-to-br from-card to-muted/30"
    >
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />

      <CardContent className="relative py-8 px-6">
        <Badge variant="secondary" className="mb-3 font-medium">
          TL;DR
        </Badge>
        <p className="text-lg leading-relaxed text-foreground">{tldr}</p>
      </CardContent>
    </Card>
  );
}
