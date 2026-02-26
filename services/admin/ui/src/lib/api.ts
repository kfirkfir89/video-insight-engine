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

// Usage endpoints
export const api = {
  usage: {
    stats: (days = 30) => apiFetch<Record<string, number>>(`/usage/stats?days=${days}`),
    daily: (days = 30) => apiFetch<Array<{ date: string; calls: number; cost_usd: number }>>(`/usage/daily?days=${days}`),
    byFeature: (days = 30) => apiFetch<Array<{ feature: string; calls: number; cost_usd: number }>>(`/usage/by-feature?days=${days}`),
    byModel: (days = 30) => apiFetch<Array<{ model: string; calls: number; cost_usd: number }>>(`/usage/by-model?days=${days}`),
    byService: (days = 30) => apiFetch<Array<{ service: string; calls: number; cost_usd: number }>>(`/usage/by-service?days=${days}`),
    byVideo: (days = 30, limit = 20) => apiFetch<Array<{ video_id: string; calls: number; cost_usd: number }>>(`/usage/by-video?days=${days}&limit=${limit}`),
    forVideo: (videoId: string) => apiFetch<Array<{ feature: string; calls: number; cost_usd: number }>>(`/usage/video/${videoId}`),
    anomalies: (threshold = 0.5, days = 7) => apiFetch<Array<Record<string, unknown>>>(`/usage/anomalies?threshold_usd=${threshold}&days=${days}`),
    recent: (limit = 20, beforeId?: string) => apiFetch<Array<Record<string, unknown>>>(`/usage/recent?limit=${limit}${beforeId ? `&before_id=${beforeId}` : ''}`),
    duplicates: (days = 7) => apiFetch<Array<Record<string, unknown>>>(`/usage/duplicates?days=${days}`),
  },
  health: {
    services: () => apiFetch<Record<string, { status: string; response_ms?: number }>>('/health/services'),
    overview: () => apiFetch<{ status: string; services: Record<string, unknown> }>('/health/overview'),
    history: (hours = 24) => apiFetch<Array<Record<string, unknown>>>(`/health/history?hours=${hours}`),
    uptime: (days = 7) => apiFetch<Record<string, { uptime_pct: number }>>('/health/uptime?days=' + days),
  },
  alerts: {
    recent: (limit = 20) => apiFetch<Array<Record<string, unknown>>>(`/alerts/recent?limit=${limit}`),
    config: () => apiFetch<Record<string, number>>('/alerts/config'),
    updateConfig: (config: Record<string, number>) =>
      apiFetch<Record<string, unknown>>(`/alerts/config?${new URLSearchParams(Object.entries(config).map(([k, v]) => [k, String(v)]))}`, { method: 'POST' }),
  },
  admin: {
    aggregateDaily: (date?: string) =>
      apiFetch<Record<string, unknown>>(`/admin/aggregate-daily${date ? `?target_date=${date}` : ''}`, { method: 'POST' }),
  },
};
