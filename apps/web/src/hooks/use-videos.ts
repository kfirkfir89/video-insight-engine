import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { videosApi } from "@/api/videos";
import { queryKeys } from "@/lib/query-keys";

// Fetch all videos (no folder filter)
export function useAllVideos() {
  return useQuery({
    queryKey: queryKeys.videos.list(),
    queryFn: () => videosApi.list(),
  });
}

// Fetch videos list (optionally filtered by folder)
export function useVideos(folderId?: string) {
  return useQuery({
    queryKey: queryKeys.videos.list(folderId),
    queryFn: () => videosApi.list({ folderId }),
  });
}

// Fetch single video
export function useVideo(id: string) {
  return useQuery({
    queryKey: queryKeys.videos.detail(id),
    queryFn: () => videosApi.get(id),
    enabled: !!id,
  });
}

// Add video mutation
export function useAddVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, folderId }: { url: string; folderId?: string | null }) =>
      videosApi.create(url, folderId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}

// Delete video mutation
export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => videosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}

// Move video to folder mutation
export function useMoveVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      videosApi.moveToFolder(id, folderId),
    onSuccess: () => {
      // Invalidate video queries
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
      // Also invalidate folder queries to update video counts
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.lists() });
    },
  });
}
