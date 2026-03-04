import { useMutation, useQuery } from "@tanstack/react-query";
import { shareApi } from "@/api/share";

export function useCreateShareLink() {
  return useMutation({
    mutationFn: ({
      videoId,
      outputId,
    }: {
      videoId: string;
      outputId: string;
    }) => shareApi.createShareLink(videoId, outputId),
    onSuccess: async (data) => {
      try {
        await navigator.clipboard.writeText(data.url);
        const { toast } = await import("sonner");
        toast.success("Link copied to clipboard!");
      } catch {
        const { toast } = await import("sonner");
        toast.error("Failed to copy link to clipboard");
      }
    },
    onError: async () => {
      const { toast } = await import("sonner");
      toast.error("Failed to create share link. Please try again.");
    },
  });
}

export function useShareOutput(slug: string) {
  return useQuery({
    queryKey: ["share", slug],
    queryFn: () => shareApi.getSharedOutput(slug),
    enabled: !!slug,
    retry: false, // Share links are immutable — a 404 won't resolve on retry
    staleTime: 5 * 60 * 1000,
  });
}
