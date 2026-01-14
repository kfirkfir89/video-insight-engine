import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KeyTakeawaysListProps {
  takeaways: string[];
}

export function KeyTakeawaysList({ takeaways }: KeyTakeawaysListProps) {
  if (takeaways.length === 0) return null;

  return (
    <Card data-slot="key-takeaways">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Key Takeaways</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {takeaways.map((takeaway, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-sm"
            >
              <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground text-xs leading-relaxed">{takeaway}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
