import { useQuery } from "@tanstack/react-query";
import { usageApi, type UserUsageSummary } from "@/api/usage";

export const usageQueryKey = ["usage", "me"] as const;

export function useUserUsage() {
  return useQuery<UserUsageSummary>({
    queryKey: usageQueryKey,
    queryFn: () => usageApi.me(),
    // The dashboard is the primary surface; refresh on focus and every 60s
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
