const API_BASE = '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

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

export function logout() {
  clearApiKey();
  window.location.reload();
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
    throw new ApiError(401, 'Unauthorized');
  }
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
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

// --- New Analytics Types ---

export interface OutputTypeUsage {
  output_type: string;
  cost_usd: number;
  calls: number;
  tokens: number;
}

export interface ShareItem {
  title: string;
  youtubeId: string;
  shareSlug: string;
  viewsCount: number;
  likesCount: number;
  sharedAt: string | null;
  outputType: string;
}

export interface ShareStats {
  total_shared: number;
  total_views: number;
  total_likes: number;
  avg_views: number;
}

export interface TierItem {
  tier: string;
  count: number;
  percentage: number;
}

export interface UserCostRow {
  userId: string;
  email: string | null;
  name: string | null;
  tier: string;
  totalCostUsd: number;
  videoCount: number;
  creditAdjustmentUsd: number;
  effectiveUsd: number;
  days: number;
}

export interface UserDailyRow {
  date: string;
  totalCostUsd: number;
  videoCount: number;
  creditAdjustmentUsd: number;
  effectiveUsd: number;
}

export interface UserCostAdjustment {
  id: string;
  date: string;
  amountUsd: number;
  reason: string;
  adminId: string | null;
  createdAt: string | null;
}

export interface UserCostDetail {
  user: UserCostRow;
  daily: UserDailyRow[];
  adjustments: UserCostAdjustment[];
}

export interface GrantCreditResponse {
  userId: string;
  date: string;
  amountUsd: number;
  creditAdjustmentUsd: number;
  effectiveUsd: number;
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
    byOutputType: (days = 30) => apiFetch<OutputTypeUsage[]>(`/usage/by-output-type${qs({ days })}`),
  },
  shares: {
    top: (days = 30, limit = 10) => apiFetch<ShareItem[]>(`/shares/top${qs({ days, limit })}`),
    stats: (days = 30) => apiFetch<ShareStats>(`/shares/stats${qs({ days })}`),
  },
  tiers: {
    distribution: () => apiFetch<TierItem[]>('/tiers/distribution'),
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
      apiFetch<Record<string, unknown>>('/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
  },
  admin: {
    aggregateDaily: (date?: string) =>
      apiFetch<Record<string, unknown>>(`/admin/aggregate-daily${qs({ target_date: date })}`, { method: 'POST' }),
  },
  users: {
    costs: (days = 7, limit = 50, offset = 0) =>
      apiFetch<UserCostRow[]>(`/users/costs${qs({ days, limit, offset })}`),
    costDetail: (userId: string, days = 30) =>
      apiFetch<UserCostDetail>(`/users/${encodeURIComponent(userId)}/costs${qs({ days })}`),
    grantCredit: (userId: string, body: { amountUsd: number; reason: string; adminId: string; date?: string }) =>
      apiFetch<GrantCreditResponse>(`/users/${encodeURIComponent(userId)}/grant-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  },
};
