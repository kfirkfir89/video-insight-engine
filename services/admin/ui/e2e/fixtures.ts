import { test as base, Page } from '@playwright/test';

// --- Mock Data ---

export const mockUsageStats = {
  total_cost_usd: 12.4567,
  total_calls: 1247,
  avg_duration_ms: 2340,
  success_count: 1199.614, // 1247 * 0.962 ~ 1199.614 -> 96.2%
};

export const mockUsageDaily = [
  { date: '2026-02-20', calls: 150, cost_usd: 1.23 },
  { date: '2026-02-21', calls: 180, cost_usd: 1.56 },
  { date: '2026-02-22', calls: 200, cost_usd: 2.01 },
  { date: '2026-02-23', calls: 170, cost_usd: 1.45 },
  { date: '2026-02-24', calls: 190, cost_usd: 1.78 },
  { date: '2026-02-25', calls: 210, cost_usd: 2.34 },
  { date: '2026-02-26', calls: 147, cost_usd: 2.07 },
];

export const mockUsageByFeature = [
  { feature: 'summarize', calls: 520, cost_usd: 5.12 },
  { feature: 'explain', calls: 430, cost_usd: 4.89 },
  { feature: 'chat', calls: 297, cost_usd: 2.44 },
];

export const mockUsageByModel = [
  { model: 'claude-sonnet-4-20250514', calls: 600, cost_usd: 6.78 },
  { model: 'gpt-4o', calls: 400, cost_usd: 3.89 },
  { model: 'claude-haiku-4-5-20251001', calls: 247, cost_usd: 1.78 },
];

export const mockUsageByService = [
  { service: 'summarizer', calls: 700, cost_usd: 8.12 },
  { service: 'explainer', calls: 547, cost_usd: 4.34 },
];

export const mockUsageRecent = [
  {
    _id: 'rec-1',
    model: 'claude-sonnet-4-20250514',
    feature: 'summarize',
    cost_usd: 0.0234,
    tokens_in: 1500,
    tokens_out: 800,
    duration_ms: 2100,
    timestamp: '2026-02-26T10:30:00Z',
  },
  {
    _id: 'rec-2',
    model: 'gpt-4o',
    feature: 'explain',
    cost_usd: 0.0156,
    tokens_in: 1200,
    tokens_out: 600,
    duration_ms: 1800,
    timestamp: '2026-02-26T10:25:00Z',
  },
  {
    _id: 'rec-3',
    model: 'claude-haiku-4-5-20251001',
    feature: 'chat',
    cost_usd: 0.0089,
    tokens_in: 800,
    tokens_out: 400,
    duration_ms: 950,
    timestamp: '2026-02-26T10:20:00Z',
  },
];

export const mockUsageByVideo = [
  {
    video_id: 'abc123',
    calls: 12,
    cost_usd: 0.0523,
    tokens_in: 15000,
    tokens_out: 8000,
    first_call: '2026-02-20T10:30:00Z',
    last_call: '2026-02-26T14:00:00Z',
    title: 'Building a REST API with FastAPI',
    channel: 'Tech Channel',
    duration: 752,
    thumbnail_url: null,
    status: 'completed',
    category: 'coding',
    processed_at: '2026-02-20T10:35:00Z',
  },
  {
    video_id: 'def456',
    calls: 8,
    cost_usd: 0.0312,
    tokens_in: 9500,
    tokens_out: 5200,
    first_call: '2026-02-22T08:00:00Z',
    last_call: '2026-02-25T16:30:00Z',
    title: 'Understanding React Server Components',
    channel: 'Frontend Masters',
    duration: 1215,
    thumbnail_url: null,
    status: 'completed',
    category: 'frontend',
    processed_at: '2026-02-22T08:05:00Z',
  },
];

export const mockVideoDetail = {
  video: {
    title: 'Building a REST API with FastAPI',
    channel: 'Tech Channel',
    duration: 752,
    thumbnail_url: null,
    status: 'completed',
    category: 'coding',
    processed_at: '2026-02-20T10:35:00Z',
  },
  summary: {
    total_calls: 12,
    total_cost_usd: 0.0523,
    total_tokens_in: 15000,
    total_tokens_out: 8000,
    avg_duration_ms: 2100,
    first_call: '2026-02-20T10:30:00Z',
    last_call: '2026-02-26T14:00:00Z',
  },
  by_feature: [
    { feature: 'summarize', calls: 8, cost_usd: 0.0389, tokens_in: 10000, tokens_out: 5500, avg_duration_ms: 2300 },
    { feature: 'explain', calls: 4, cost_usd: 0.0134, tokens_in: 5000, tokens_out: 2500, avg_duration_ms: 1800 },
  ],
  calls: [
    { _id: 'call-1', model: 'claude-sonnet-4-20250514', feature: 'summarize', cost_usd: 0.0089, tokens_in: 1500, tokens_out: 800, duration_ms: 2100, timestamp: '2026-02-26T14:00:00Z' },
    { _id: 'call-2', model: 'gpt-4o', feature: 'explain', cost_usd: 0.0045, tokens_in: 1200, tokens_out: 600, duration_ms: 1800, timestamp: '2026-02-26T12:00:00Z' },
  ],
};

export const mockUsageDuplicates = [
  { video_id: 'dup-vid-1', model: 'claude-sonnet-4-20250514', count: 3, total_cost_usd: 0.0702 },
];

export const mockHealthServices = {
  api: { status: 'healthy', response_ms: 45 },
  summarizer: { status: 'healthy', response_ms: 120 },
  explainer: { status: 'degraded', response_ms: 3200 },
  mongodb: { status: 'healthy', response_ms: 8 },
};

export const mockHealthOverview = {
  status: 'degraded',
  services: mockHealthServices,
};

export const mockHealthUptime = {
  api: { uptime_pct: 99.85 },
  summarizer: { uptime_pct: 98.21 },
  explainer: { uptime_pct: 95.5 },
  mongodb: { uptime_pct: 100 },
};

export const mockAlertsRecent = [
  {
    _id: 'alert-1',
    type: 'high_cost',
    model: 'claude-sonnet-4-20250514',
    feature: 'summarize',
    cost_usd: 0.8923,
    timestamp: '2026-02-26T09:00:00Z',
  },
  {
    _id: 'alert-2',
    type: 'spike',
    model: 'gpt-4o',
    feature: 'explain',
    cost_usd: 0.4512,
    timestamp: '2026-02-26T08:30:00Z',
  },
  {
    _id: 'alert-3',
    type: 'failure',
    model: 'claude-haiku-4-5-20251001',
    feature: 'chat',
    cost_usd: 0.0,
    timestamp: '2026-02-26T08:00:00Z',
  },
];

export const mockAlertConfig = {
  cost_threshold_usd: 0.5,
  daily_spike_multiplier: 2,
  failure_rate_threshold: 0.2,
};

// --- Route Interception ---

export async function setupAdminApiMocks(page: Page) {
  // Video detail must be registered before by-video to avoid pattern collision
  await page.route('**/usage/video/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockVideoDetail),
    });
  });

  await page.route('**/usage/by-video*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageByVideo),
    });
  });

  await page.route('**/usage/stats*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageStats),
    });
  });

  await page.route('**/usage/daily*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageDaily),
    });
  });

  await page.route('**/usage/by-feature*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageByFeature),
    });
  });

  await page.route('**/usage/by-model*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageByModel),
    });
  });

  await page.route('**/usage/by-service*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageByService),
    });
  });

  await page.route('**/usage/recent*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageRecent),
    });
  });

  await page.route('**/usage/duplicates*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsageDuplicates),
    });
  });

  await page.route('**/health/services*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockHealthServices),
    });
  });

  await page.route('**/health/overview*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockHealthOverview),
    });
  });

  await page.route('**/health/uptime*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockHealthUptime),
    });
  });

  await page.route('**/alerts/recent*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAlertsRecent),
    });
  });

  await page.route('**/alerts/config*', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAlertConfig),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    }
  });
}

// --- Test Fixture ---

export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ page }, use) => {
    // Set up API mocks BEFORE navigation
    await setupAdminApiMocks(page);

    // Inject admin API key into localStorage before page scripts run
    await page.addInitScript(() => {
      localStorage.setItem('admin_api_key', 'test-admin-key');
    });

    // Navigate to the app
    await page.goto('/');

    // Wait for the app to render (nav header indicates auth passed)
    await page.waitForSelector('header nav', { timeout: 10_000 });

    await use(page);
  },
});

export { expect } from '@playwright/test';
