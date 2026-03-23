import { Layout } from "@/components/layout/Layout";
import { AddVideoInput } from "@/components/sidebar/AddVideoInput";
import { Sparkles } from "lucide-react";

export function GeneratePage() {
  return (
    <Layout showSidebar>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-xl w-full text-center space-y-8">
          <div className="space-y-3">
            <Sparkles className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Generate a new VIE
            </h1>
            <p className="text-muted-foreground">
              Paste a YouTube URL to create an AI-powered summary.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <AddVideoInput />
          </div>
        </div>
      </div>
    </Layout>
  );
}
