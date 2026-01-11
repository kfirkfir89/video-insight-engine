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
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {takeaways.map((takeaway, index) => (
            <div
              key={index}
              className="flex items-start gap-2.5 text-sm"
            >
              <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{takeaway}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
