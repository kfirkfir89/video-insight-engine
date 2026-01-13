import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveSection = "summarized" | "memorized";
export type SidebarTextSize = "small" | "medium" | "large";
export type SortOption = "name-asc" | "name-desc" | "created-asc" | "created-desc";

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

  // Sidebar text size preference
  sidebarTextSize: SidebarTextSize;

  // Sort preference (persisted)
  sidebarSortOption: SortOption;

  // Search query (not persisted, cleared on reload)
  sidebarSearchQuery: string;

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
  collapseAllFolders: () => void;
  isFolderExpanded: (folderId: string) => boolean;
  openAddVideoDialog: () => void;
  closeAddVideoDialog: () => void;
  setSidebarTextSize: (size: SidebarTextSize) => void;
  setSidebarSortOption: (option: SortOption) => void;
  setSidebarSearchQuery: (query: string) => void;
  clearSidebarSearch: () => void;
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
      sidebarTextSize: "medium",
      sidebarSortOption: "name-asc",
      sidebarSearchQuery: "",
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
      collapseAllFolders: () => set({ expandedFolderIds: [] }),
      isFolderExpanded: (folderId) => get().expandedFolderIds.includes(folderId),
      openAddVideoDialog: () => set({ addVideoDialogOpen: true }),
      closeAddVideoDialog: () => set({ addVideoDialogOpen: false }),
      setSidebarTextSize: (size) => set({ sidebarTextSize: size }),
      setSidebarSortOption: (option) => set({ sidebarSortOption: option }),
      setSidebarSearchQuery: (query) => set({ sidebarSearchQuery: query }),
      clearSidebarSearch: () => set({ sidebarSearchQuery: "" }),
    }),
    {
      name: "vie-ui-store",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        activeSection: state.activeSection,
        summarizedSectionOpen: state.summarizedSectionOpen,
        memorizedSectionOpen: state.memorizedSectionOpen,
        expandedFolderIds: state.expandedFolderIds,
        sidebarTextSize: state.sidebarTextSize,
        sidebarSortOption: state.sidebarSortOption,
      }),
    }
  )
);

// Selectors
export const useSidebarOpen = () => useUIStore((s) => s.sidebarOpen);
export const useSelectedFolder = () => useUIStore((s) => s.selectedFolderId);
export const useActiveSection = () => useUIStore((s) => s.activeSection);
export const useSidebarTextSize = () => useUIStore((s) => s.sidebarTextSize);
export const useSidebarSortOption = () => useUIStore((s) => s.sidebarSortOption);
export const useSidebarSearchQuery = () => useUIStore((s) => s.sidebarSearchQuery);
