import { config } from '../config.js';

interface SummarizeRequest {
  videoSummaryId: string;
  youtubeId: string;
  url: string;
  userId?: string;
}

export async function triggerSummarization(request: SummarizeRequest): Promise<void> {
  // Fire and forget - don't await the processing
  fetch(`${config.SUMMARIZER_URL}/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }).catch((err) => {
    console.error('Failed to trigger summarization:', err);
  });
}
