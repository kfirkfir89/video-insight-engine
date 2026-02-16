import { useQuery } from "@tanstack/react-query";
import { explainApi } from "@/api/explain";

/**
 * Hook to fetch auto-generated expansion for a section or concept.
 * Results are cached server-side in systemExpansionCache.
 */
export function useExplainAuto(
  videoSummaryId: string | undefined,
  targetType: "section" | "concept",
  targetId: string | undefined
) {
  return useQuery({
    queryKey: ["explain", "auto", videoSummaryId, targetType, targetId],
    queryFn: () =>
      explainApi.explainAuto(videoSummaryId!, targetType, targetId!),
    enabled: !!videoSummaryId && !!targetId,
    staleTime: 1000 * 60 * 30, // 30 minutes — server caches indefinitely
  });
}
