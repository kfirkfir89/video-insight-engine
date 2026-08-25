import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TabEntry } from '@vie/types';

import { OutputRouter } from '../OutputRouter';

function makeMomentItems(count: number, withThumbCount: number): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    time: `${i}:00`,
    seconds: i * 60,
    label: `Moment ${i}`,
    ...(i < withThumbCount ? { thumbnailUrl: `https://example.com/f${i}.jpg` } : {}),
  }));
}

function momentTab(items: Array<Record<string, unknown>>): TabEntry {
  return { id: 'moments', label: 'Moments', emoji: '🎬', component: 'moment_track', props: { items } };
}

const filmstripTab: TabEntry = {
  id: 'filmstrip',
  label: 'Filmstrip',
  emoji: '🎞️',
  component: 'video_filmstrip',
  props: {
    frames: [
      { thumbnailUrl: 'https://example.com/a.jpg', timestamp: 10 },
      { thumbnailUrl: 'https://example.com/b.jpg', timestamp: 20 },
      { thumbnailUrl: 'https://example.com/c.jpg', timestamp: 30 },
    ],
  },
};

const overviewTab: TabEntry = {
  id: 'overview',
  label: 'Overview',
  emoji: '🧭',
  component: 'overview',
  props: { brief: 'A briefing' },
};

function renderRouter(tabs: TabEntry[]) {
  return render(
    <OutputRouter
      title="Test video"
      videoSummaryId="vid-1"
      tabs={tabs}
      meta={null}
      synthesis={null}
    />,
  );
}

describe('OutputRouter tab filtering', () => {
  it('drops the filmstrip tab when a moment_track has rich frame coverage (≥8 thumbnails)', () => {
    renderRouter([momentTab(makeMomentItems(10, 8)), filmstripTab]);
    expect(screen.getAllByText('Moments').length).toBeGreaterThan(0);
    expect(screen.queryByText('Filmstrip')).toBeNull();
  });

  it('keeps the filmstrip tab when the moment_track is frame-sparse', () => {
    renderRouter([momentTab(makeMomentItems(10, 3)), filmstripTab]);
    expect(screen.getAllByText('Filmstrip').length).toBeGreaterThan(0);
  });

  it('keeps the filmstrip tab when there is no moment_track at all', () => {
    renderRouter([filmstripTab]);
    expect(screen.getAllByText('Filmstrip').length).toBeGreaterThan(0);
  });

  it('still filters the overview tab from the strip', () => {
    renderRouter([overviewTab, momentTab(makeMomentItems(4, 0))]);
    expect(screen.getAllByText('Moments').length).toBeGreaterThan(0);
    expect(screen.queryByText('Overview')).toBeNull();
  });
});
