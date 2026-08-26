// Feature barrel export — public API for video-output feature
// Additive only: don't update existing import paths in this PR

// Hooks
export { useProcessingManager } from './hooks/use-processing-manager';
export { useSummaryStream } from './hooks/use-summary-stream';

// Stores
export { useProcessingStore, useProcessingStreamState, toProcessingStreamState } from './stores/processing-store';

// Contexts
export { VideoPlayerProvider, useVideoPlayer } from './contexts/VideoPlayerContext';
export { TabStateProvider, useTabState } from './contexts/TabStateContext';

// Components
export { OutputRouter } from './components/OutputRouter';
export { StreamingPlaceholder, StreamErrorCard } from './components/StreamingPlaceholder';

// Utilities
export { OUTPUT_TYPE_CONFIG, getOutputTypeConfig } from './lib/output-type-config';
export { buildSynthesisFromMeta } from './lib/synthesis-utils';
