import { Layout } from "@/components/layout/Layout";
import { AddVideoInput } from "@/features/sidebar/videos/AddVideoInput";
import { Sparkles } from "lucide-react";

export function GeneratePage() {
  return (
    <Layout showSidebar>
      <div className="surface-ambient flex-1 flex flex-col items-center justify-center page-gutter page-gutter-y">
        <div className="max-w-xl w-full text-center stack-xl">
          <div className="stack-sm">
            <div className="icon-glow mx-auto">
              <Sparkles className="h-10 w-10 text-primary icon-float" aria-hidden="true" />
            </div>
            <h1 className="type-page-title text-balance">
              Turn a video into a study guide
            </h1>
            <p className="type-caption text-pretty">
              Paste a YouTube link and we&apos;ll break it down — summary, key points, flashcards, and more.
            </p>
          </div>

          <div className="max-w-md mx-auto w-full">
            <AddVideoInput />
          </div>
        </div>
      </div>
    </Layout>
  );
}
