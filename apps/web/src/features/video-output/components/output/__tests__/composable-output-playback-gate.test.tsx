import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { TabEntry } from '@vie/types';

// Mock cross-tab link dependencies (same as composable-output.test.tsx).
vi.mock('../CrossTabLink', () => ({
  CrossTabLink: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock('../link-rules', () => ({
  resolveCrossTabLinks: () => ({}),
}));

// Controllable player context: `currentTime` keeps its last polled value after
// the player closes, and ComposableOutput must gate it on `isPlayerOpen`.
const playerState = {
  isPlayerOpen: false,
  currentTime: 0,
};
vi.mock('@/features/video-output/contexts/VideoPlayerContext', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/video-output/contexts/VideoPlayerContext')
  >('@/features/video-output/contexts/VideoPlayerContext');
  return {
    ...actual,
    useVideoPlayer: () => ({
      seekTo: vi.fn(),
      openPlayer: vi.fn(),
      closePlayer: vi.fn(),
      togglePlayer: vi.fn(),
      registerPlayerAnchor: vi.fn(),
      playerRef: { current: null },
      hasEngaged: true,
      isPlayerOpen: playerState.isPlayerOpen,
      currentTime: playerState.currentTime,
    }),
  };
});

import { ComposableOutput } from '../ComposableOutput';

const momentTab: TabEntry = {
  id: 'moments',
  label: 'Moments',
  emoji: '🎬',
  component: 'moment_track',
  props: {
    items: [
      { time: '0:30', seconds: 30, label: 'Opening' },
      { time: '2:00', seconds: 120, endSeconds: 180, label: 'Peak' },
      { time: '5:00', seconds: 300, label: 'Wrap-up' },
    ],
  },
};

const response = {
  meta: {
    videoId: 'v1',
    videoTitle: 'Test Video',
    creator: 'Tester',
    contentTags: ['travel' as const],
    modifiers: [],
    primaryTag: 'travel' as const,
    userGoal: 'Watch',
  },
  tabs: [],
};

function renderMoments(): HTMLElement {
  const { container } = render(
    <ComposableOutput
      response={response}
      tabs={[momentTab]}
      activeTab="moments"
      onNavigateTab={vi.fn()}
    />,
  );
  return container;
}

describe('ComposableOutput playback-position gate', () => {
  beforeEach(() => {
    playerState.isPlayerOpen = false;
    playerState.currentTime = 0;
  });

  it('should mark the playing moment active while the player is open', () => {
    playerState.isPlayerOpen = true;
    playerState.currentTime = 130;

    const container = renderMoments();

    expect(container.querySelectorAll('[data-active="true"]').length).toBeGreaterThan(0);
  });

  it('should drop the stale active marker when the player is closed', () => {
    // Regression: currentTime persists after close; leaking it left activeIndex
    // pinned and permanently disabled the timeline focus band.
    playerState.isPlayerOpen = false;
    playerState.currentTime = 130;

    const container = renderMoments();

    expect(container.querySelectorAll('[data-active="true"]').length).toBe(0);
  });
});
