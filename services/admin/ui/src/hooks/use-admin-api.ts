import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useUsageStats(days = 30) {
  return useQuery({ queryKey: ['usage-stats', days], queryFn: () => api.usage.stats(days), refetchInterval: 30_000 });
}

export function useUsageDaily(days = 30) {
  return useQuery({ queryKey: ['usage-daily', days], queryFn: () => api.usage.daily(days), refetchInterval: 30_000 });
}

export function useUsageByFeature(days = 30) {
  return useQuery({ queryKey: ['usage-by-feature', days], queryFn: () => api.usage.byFeature(days) });
}

export function useUsageByModel(days = 30) {
  return useQuery({ queryKey: ['usage-by-model', days], queryFn: () => api.usage.byModel(days) });
}

export function useUsageByService(days = 30) {
  return useQuery({ queryKey: ['usage-by-service', days], queryFn: () => api.usage.byService(days) });
}

export function useUsageByVideo(days = 30, limit = 50) {
  return useQuery({ queryKey: ['usage-by-video', days, limit], queryFn: () => api.usage.byVideo(days, limit) });
}

export function useVideoDetail(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-detail', videoId],
    queryFn: () => api.usage.forVideo(videoId!),
    enabled: !!videoId,
    staleTime: 60_000,
  });
}

export function useUsageRecent(limit = 20) {
  return useQuery({ queryKey: ['usage-recent', limit], queryFn: () => api.usage.recent(limit), refetchInterval: 10_000 });
}

export function useUsageDuplicates(days = 7) {
  return useQuery({ queryKey: ['usage-duplicates', days], queryFn: () => api.usage.duplicates(days) });
}

export function useHealthServices() {
  return useQuery({ queryKey: ['health-services'], queryFn: () => api.health.services(), refetchInterval: 15_000 });
}

export function useHealthOverview() {
  return useQuery({ queryKey: ['health-overview'], queryFn: () => api.health.overview(), refetchInterval: 15_000 });
}

export function useHealthUptime(days = 7) {
  return useQuery({ queryKey: ['health-uptime', days], queryFn: () => api.health.uptime(days) });
}

export function useAlertsRecent(limit = 20) {
  return useQuery({ queryKey: ['alerts-recent', limit], queryFn: () => api.alerts.recent(limit), refetchInterval: 30_000 });
}

export function useAlertConfig() {
  return useQuery({ queryKey: ['alert-config'], queryFn: () => api.alerts.config() });
}

export function useUsageByOutputType(days = 30) {
  return useQuery({ queryKey: ['usage-by-output-type', days], queryFn: () => api.usage.byOutputType(days) });
}

export function useSharesTop(days = 30, limit = 10) {
  return useQuery({ queryKey: ['shares-top', days, limit], queryFn: () => api.shares.top(days, limit) });
}

export function useSharesStats(days = 30) {
  return useQuery({ queryKey: ['shares-stats', days], queryFn: () => api.shares.stats(days) });
}

export function useTierDistribution() {
  return useQuery({ queryKey: ['tier-distribution'], queryFn: () => api.tiers.distribution() });
}
