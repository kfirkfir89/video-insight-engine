/**
 * Category Video Example Component - Dev Only
 *
 * Renders a complete video detail view with mock data for a given category.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('CategoryVideoExample should not be imported in production');
}

import { useState } from 'react';
import type { VideoCategory, SummaryChapter } from '@vie/types';
import { getMockVideo } from '@/lib/dev/mock-videos';
import { ChevronDown, ChevronRight, Clock, Play } from 'lucide-react';

// Import real components for rendering
import { ContentBlockRenderer } from '@/components/video-detail/ContentBlockRenderer';

interface CategoryVideoExampleProps {
  category: VideoCategory;
}

function TldrSection({ tldr, keyTakeaways }: { tldr: string; keyTakeaways: string[] }) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">TL;DR</h2>
        <p className="mt-2 text-lg">{tldr}</p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Key Takeaways</h3>
        <ul className="mt-2 space-y-2">
          {keyTakeaways.map((takeaway, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{takeaway}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChapterSection({ chapter, isExpanded, onToggle }: {
  chapter: SummaryChapter;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{chapter.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{chapter.timestamp}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          aria-label={`Play from ${chapter.timestamp}`}
        >
          <Play className="h-3.5 w-3.5" />
          Play
        </button>
      </button>

      {isExpanded && chapter.content && (
        <div className="border-t p-4 space-y-4">
          {chapter.content.map((block) => (
            <ContentBlockRenderer key={block.blockId} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoHeader({
  title,
  channel,
  duration
}: {
  title: string;
  channel: string | null;
  duration: number | null;
}) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {channel && <span>{channel}</span>}
        {duration && (
          <>
            <span>•</span>
            <span>{formatDuration(duration)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ResourcesPanel({ analysis }: { analysis: NonNullable<ReturnType<typeof getMockVideo>['video']['descriptionAnalysis']> }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="font-semibold">Resources</h3>

      {analysis.links.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Links</h4>
          <ul className="space-y-1">
            {analysis.links.map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  className="text-sm text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.socialLinks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Social</h4>
          <div className="flex gap-2">
            {analysis.socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                className="text-sm capitalize text-muted-foreground hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.platform}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryVideoExample({ category }: CategoryVideoExampleProps) {
  const { video, summary } = getMockVideo(category);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set([summary.chapters[0]?.id]));

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  return (
    <div className="container py-8">
      <div className="grid gap-8 lg:grid-cols-[1fr,300px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Video Player Placeholder */}
          <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
            <div className="text-center">
              <Play className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Video Player (Mock)</p>
            </div>
          </div>

          {/* Video Info */}
          <VideoHeader
            title={video.title}
            channel={video.channel}
            duration={video.duration}
          />

          {/* TL;DR */}
          <TldrSection tldr={summary.tldr} keyTakeaways={summary.keyTakeaways} />

          {/* Chapters */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Chapters</h2>
            {summary.chapters.map((chapter) => (
              <ChapterSection
                key={chapter.id}
                chapter={chapter}
                isExpanded={expandedChapters.has(chapter.id)}
                onToggle={() => toggleChapter(chapter.id)}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Resources */}
          {video.descriptionAnalysis && (
            <ResourcesPanel analysis={video.descriptionAnalysis} />
          )}

          {/* Concepts */}
          {summary.concepts.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-3">Key Concepts</h3>
              <ul className="space-y-2">
                {summary.concepts.map((concept) => (
                  <li key={concept.id} className="text-sm">
                    <span className="font-medium">{concept.name}</span>
                    {concept.definition && (
                      <p className="text-muted-foreground mt-0.5">{concept.definition}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Category Info */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-3">Video Info</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium capitalize">{video.context?.category}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">YouTube Category</dt>
                <dd className="font-medium">{video.context?.youtubeCategory}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chapters</dt>
                <dd className="font-medium">{summary.chapters.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{video.status}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
