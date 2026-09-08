import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/use-admin-api', () => ({
  useUsageAnomalies: vi.fn(),
}));

import { useUsageAnomalies } from '../hooks/use-admin-api';
import { AnomaliesPanel } from './AnomaliesPanel';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('AnomaliesPanel', () => {
  it('should render expensive calls with audio volume for transcription rows', () => {
    vi.mocked(useUsageAnomalies).mockReturnValue({
      data: [
        { _id: 'a', model: 'openai/whisper-1', feature: 'summarize:transcript:whisper', cost_usd: 0.72, unit: 'audio_seconds', audio_seconds: 600, timestamp: new Date().toISOString() },
        { _id: 'b', model: 'anthropic/claude-sonnet-4-6', feature: 'summarize:plan', cost_usd: 0.61, tokens_in: 90000, tokens_out: 4000, timestamp: new Date().toISOString() },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useUsageAnomalies>);
    render(<AnomaliesPanel />, { wrapper });
    expect(screen.getByText('10.0 min audio')).toBeTruthy();
    expect(screen.getByText('94,000')).toBeTruthy();
    expect(screen.getByText('$0.7200')).toBeTruthy();
  });

  it('should render an empty state', () => {
    vi.mocked(useUsageAnomalies).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useUsageAnomalies>);
    render(<AnomaliesPanel thresholdUsd={1} />, { wrapper });
    expect(screen.getByText('No calls above $1.00')).toBeTruthy();
  });
});
