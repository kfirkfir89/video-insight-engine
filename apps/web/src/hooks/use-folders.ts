import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { foldersApi, type CreateFolderInput, type UpdateFolderInput } from "@/api/folders";
import { queryKeys } from "@/lib/query-keys";
import type { FolderType } from "@/types";

// Fetch folders list
export function useFolders(type?: FolderType) {
  return useQuery({
    queryKey: queryKeys.folders.list(type),
    queryFn: () => foldersApi.list(type),
  });
}

// Fetch single folder
export function useFolder(id: string) {
  return useQuery({
    queryKey: queryKeys.folders.detail(id),
    queryFn: () => foldersApi.get(id),
    enabled: !!id,
  });
}

// Create folder mutation
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFolderInput) => foldersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.lists() });
    },
  });
}

// Update folder mutation
export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFolderInput }) =>
      foldersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.lists() });
    },
  });
}

// Delete folder mutation
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteContent }: { id: string; deleteContent?: boolean }) =>
      foldersApi.delete(id, deleteContent),
    onSuccess: () => {
      // Invalidate folder queries
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.lists() });
      // CRITICAL: Also invalidate video queries since videos are moved/deleted
      queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });
    },
  });
}
