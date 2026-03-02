const API_BASE = '';

function getApiKey(): string | null {
  return localStorage.getItem('admin_api_key');
}

export function setApiKey(key: string) {
  localStorage.setItem('admin_api_key', key);
}

export function clearApiKey() {
  localStorage.removeItem('admin_api_key');
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

/** Build a query string from key-value pairs, omitting undefined values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getApiKey();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
  });
  if (res.status === 401) {
    clearApiKey();
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Types ---

export interface VideoSummaryItem {
  video_id: string;
  calls: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  first_call: string | null;
  last_call: string | null;
  title: string | null;
  channel: string | null;
  duration: number | null;
  thumbnail_url: string | null;
  status: string | null;
  category: string | null;
  processed_at: string | null;
}

export interface VideoDetailResponse {
  video: {
    title: string | null;
    channel: string | null;
    duration: number | null;
    thumbnail_url: string | null;
    status: string | null;
    category: string | null;
    processed_at: string | null;
  } | null;
  summary: {
    total_calls: number;
    total_cost_usd: number;
    total_tokens_in: number;
    total_tokens_out: number;
    avg_duration_ms: number;
    first_call: string | null;
    last_call: string | null;
  };
  by_feature: Array<{
    feature: string;
    calls: number;
    cost_usd: number;
    tokens_in: number;
    tokens_out: number;
    avg_duration_ms: number;
  }>;
  calls: Array<{
    _id: string;
    model: string;
    feature: string;
    cost_usd: number;
    tokens_in: number;
    tokens_out: number;
    duration_ms: number;
    timestamp: string;
    video_id?: string;
    service?: string;
    success?: boolean;
  }>;
}

// Usage endpoints
export const api = {
  usage: {
    stats: (days = 30) => apiFetch<Record<string, number>>(`/usage/stats${qs({ days })}`),
    daily: (days = 30) => apiFetch<Array<{ date: string; calls: number; cost_usd: number }>>(`/usage/daily${qs({ days })}`),
    byFeature: (days = 30) => apiFetch<Array<{ feature: string; calls: number; cost_usd: number }>>(`/usage/by-feature${qs({ days })}`),
    byModel: (days = 30) => apiFetch<Array<{ model: string; calls: number; cost_usd: number }>>(`/usage/by-model${qs({ days })}`),
    byService: (days = 30) => apiFetch<Array<{ service: string; calls: number; cost_usd: number }>>(`/usage/by-service${qs({ days })}`),
    byVideo: (days = 30, limit = 20) => apiFetch<VideoSummaryItem[]>(`/usage/by-video${qs({ days, limit })}`),
    forVideo: (videoId: string) => apiFetch<VideoDetailResponse>(`/usage/video/${encodeURIComponent(videoId)}`),
    anomalies: (threshold = 0.5, days = 7) => apiFetch<Array<Record<string, unknown>>>(`/usage/anomalies${qs({ threshold_usd: threshold, days })}`),
    recent: (limit = 20, beforeId?: string) => apiFetch<Array<Record<string, unknown>>>(`/usage/recent${qs({ limit, before_id: beforeId })}`),
    duplicates: (days = 7) => apiFetch<Array<Record<string, unknown>>>(`/usage/duplicates${qs({ days })}`),
  },
  health: {
    services: () => apiFetch<Record<string, { status: string; response_ms?: number }>>('/health/services'),
    overview: () => apiFetch<{ status: string; services: Record<string, unknown> }>('/health/overview'),
    history: (hours = 24) => apiFetch<Array<Record<string, unknown>>>(`/health/history${qs({ hours })}`),
    uptime: (days = 7) => apiFetch<Record<string, { uptime_pct: number }>>(`/health/uptime${qs({ days })}`),
  },
  alerts: {
    recent: (limit = 20) => apiFetch<Array<Record<string, unknown>>>(`/alerts/recent${qs({ limit })}`),
    config: () => apiFetch<Record<string, number>>('/alerts/config'),
    updateConfig: (config: Record<string, number>) =>
      apiFetch<Record<string, unknown>>(`/alerts/config${qs(config)}`, { method: 'POST' }),
  },
  admin: {
    aggregateDaily: (date?: string) =>
      apiFetch<Record<string, unknown>>(`/admin/aggregate-daily${qs({ target_date: date })}`, { method: 'POST' }),
  },
};
