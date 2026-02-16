import { createContext, useContext, type ReactNode } from 'react';

const VideoSummaryIdContext = createContext<string>('');

interface VideoSummaryIdProviderProps {
  videoSummaryId: string;
  children: ReactNode;
}

export function VideoSummaryIdProvider({ videoSummaryId, children }: VideoSummaryIdProviderProps) {
  return (
    <VideoSummaryIdContext.Provider value={videoSummaryId}>
      {children}
    </VideoSummaryIdContext.Provider>
  );
}

export function useVideoSummaryId(): string {
  return useContext(VideoSummaryIdContext);
}
