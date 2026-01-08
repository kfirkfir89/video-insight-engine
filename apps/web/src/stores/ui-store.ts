import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  addVideoDialogOpen: boolean;
  selectedFolderId: string | null;

  // Actions
  toggleSidebar: () => void;
  openAddVideoDialog: () => void;
  closeAddVideoDialog: () => void;
  setSelectedFolder: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  addVideoDialogOpen: false,
  selectedFolderId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openAddVideoDialog: () => set({ addVideoDialogOpen: true }),
  closeAddVideoDialog: () => set({ addVideoDialogOpen: false }),
  setSelectedFolder: (id) => set({ selectedFolderId: id }),
}));

// Selectors
export const useSidebarOpen = () => useUIStore((s) => s.sidebarOpen);
export const useSelectedFolder = () => useUIStore((s) => s.selectedFolderId);
