// Query key factory for type-safe cache management
export const queryKeys = {
  // Videos
  videos: {
    all: ["videos"] as const,
    lists: () => [...queryKeys.videos.all, "list"] as const,
    list: (folderId?: string) =>
      [...queryKeys.videos.lists(), { folderId }] as const,
    details: () => [...queryKeys.videos.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.videos.details(), id] as const,
  },

  // Folders
  folders: {
    all: ["folders"] as const,
    lists: () => [...queryKeys.folders.all, "list"] as const,
    list: (type?: string) => [...queryKeys.folders.lists(), { type }] as const,
    details: () => [...queryKeys.folders.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.folders.details(), id] as const,
  },

  // User
  user: {
    current: ["user", "current"] as const,
  },
} as const;
