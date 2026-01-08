import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveSection = "summarized" | "memorized";

interface UIState {
  // Sidebar visibility
  sidebarOpen: boolean;

  // Content context
  activeSection: ActiveSection;
  selectedFolderId: string | null;

  // Section collapse states
  summarizedSectionOpen: boolean;
  memorizedSectionOpen: boolean;

  // Folder expansion state (persisted as array, used as Set in memory)
  expandedFolderIds: string[];

  // Legacy (keep for AddVideoDialog if needed elsewhere)
  addVideoDialogOpen: boolean;

  // Actions
  toggleSidebar: () => void;
  setActiveSection: (section: ActiveSection) => void;
  setSelectedFolder: (id: string | null) => void;
  toggleSummarizedSection: () => void;
  toggleMemorizedSection: () => void;
  toggleFolderExpansion: (folderId: string) => void;
  expandFolder: (folderId: string) => void;
  collapseFolder: (folderId: string) => void;
  isFolderExpanded: (folderId: string) => boolean;
  openAddVideoDialog: () => void;
  closeAddVideoDialog: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarOpen: true,
      activeSection: "summarized",
      selectedFolderId: null,
      summarizedSectionOpen: true,
      memorizedSectionOpen: true,
      expandedFolderIds: [],
      addVideoDialogOpen: false,

      // Actions
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setActiveSection: (section) => set({ activeSection: section }),
      setSelectedFolder: (id) => set({ selectedFolderId: id }),
      toggleSummarizedSection: () =>
        set((s) => ({ summarizedSectionOpen: !s.summarizedSectionOpen })),
      toggleMemorizedSection: () =>
        set((s) => ({ memorizedSectionOpen: !s.memorizedSectionOpen })),
      toggleFolderExpansion: (folderId) =>
        set((s) => {
          const ids = s.expandedFolderIds;
          if (ids.includes(folderId)) {
            return { expandedFolderIds: ids.filter((id) => id !== folderId) };
          } else {
            return { expandedFolderIds: [...ids, folderId] };
          }
        }),
      expandFolder: (folderId) =>
        set((s) => {
          if (s.expandedFolderIds.includes(folderId)) {
            return s;
          }
          return { expandedFolderIds: [...s.expandedFolderIds, folderId] };
        }),
      collapseFolder: (folderId) =>
        set((s) => ({
          expandedFolderIds: s.expandedFolderIds.filter((id) => id !== folderId),
        })),
      isFolderExpanded: (folderId) => get().expandedFolderIds.includes(folderId),
      openAddVideoDialog: () => set({ addVideoDialogOpen: true }),
      closeAddVideoDialog: () => set({ addVideoDialogOpen: false }),
    }),
    {
      name: "vie-ui-store",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        activeSection: state.activeSection,
        summarizedSectionOpen: state.summarizedSectionOpen,
        memorizedSectionOpen: state.memorizedSectionOpen,
        expandedFolderIds: state.expandedFolderIds,
      }),
    }
  )
);

// Selectors
export const useSidebarOpen = () => useUIStore((s) => s.sidebarOpen);
export const useSelectedFolder = () => useUIStore((s) => s.selectedFolderId);
export const useActiveSection = () => useUIStore((s) => s.activeSection);
