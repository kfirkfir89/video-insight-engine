import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { videosApi } from "@/api/videos";
import { queryKeys } from "@/lib/query-keys";

// Fetch videos list
export function useVideos(folderId?: string) {
  return useQuery({
    queryKey: queryKeys.videos.list(folderId),
    queryFn: () => videosApi.list(folderId),
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
    mutationFn: (url: string) => videosApi.create(url),
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
