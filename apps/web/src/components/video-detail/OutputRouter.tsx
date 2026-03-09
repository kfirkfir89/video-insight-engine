import { type VideoResponse, type VideoOutput } from '@vie/types';
import { OutputShell } from './output/OutputShell';
import type { StreamState } from '../../hooks/use-summary-stream';

interface OutputRouterProps {
  video: VideoResponse;
  output: VideoOutput | null;
  isStreaming?: boolean;
  streamingState?: StreamState;
}

export function OutputRouter({
  video,
  output,
  isStreaming,
  streamingState,
}: OutputRouterProps) {
  if (!output) {
    return null;
  }

  return (
    <OutputShell
      video={video}
      output={output}
      isStreaming={isStreaming}
      streamingState={streamingState}
    />
  );
}
