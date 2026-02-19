import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Compute range selection between anchor and target in item order.
 * Returns video and folder IDs in the selected range.
 */
function computeRangeSelection(
  itemOrder: string[],
  anchorId: string,
  targetId: string,
  preserveExisting: boolean,
  existingVideoIds: string[],
  existingFolderIds: string[]
): { videoIds: string[]; folderIds: string[] } | null {
  const anchorIndex = itemOrder.indexOf(anchorId);
  const targetIndex = itemOrder.indexOf(targetId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return null;
  }

  const startIndex = Math.min(anchorIndex, targetIndex);
  const endIndex = Math.max(anchorIndex, targetIndex);

  const rangeItems = itemOrder.slice(startIndex, endIndex + 1);

  const rangeVideoIds: string[] = [];
  const rangeFolderIds: string[] = [];

  for (const itemId of rangeItems) {
    if (itemId.startsWith("v_")) {
      rangeVideoIds.push(itemId.slice(2));
    } else if (itemId.startsWith("f_")) {
      rangeFolderIds.push(itemId.slice(2));
    }
  }

  if (preserveExisting) {
    // Merge with existing selection
    const videoSet = new Set([...existingVideoIds, ...rangeVideoIds]);
    const folderSet = new Set([...existingFolderIds, ...rangeFolderIds]);
    return {
      videoIds: Array.from(videoSet),
      folderIds: Array.from(folderSet),
    };
  }

  return {
    videoIds: rangeVideoIds,
    folderIds: rangeFolderIds,
  };
}

export type ActiveSection = "summarized" | "memorized";

export type RightPanelId = "none" | "minimap" | "chapters" | "chat";

export type SidebarTextSize = "small" | "medium" | "large";
export type SortOption = "name-asc" | "name-desc" | "created-asc" | "created-desc";

interface UIState {
  // Sidebar visibility
  sidebarOpen: boolean;
  activeRightPanel: RightPanelId;
  isRightPanelMinimized: boolean;
  sidebarWidth: number;

  // Content context
  activeSection: ActiveSection;
  selectedFolderId: string | null;

  // Folder expansion state (persisted as array, used as Set in memory)
  expandedFolderIds: string[];

  // Sidebar text size preference
  sidebarTextSize: SidebarTextSize;

  // Sort preference (persisted)
  sidebarSortOption: SortOption;

  // Search query (not persisted, cleared on reload)
  sidebarSearchQuery: string;

  // New folder input visibility (triggered from SidebarTabs, consumed by SidebarSection)
  showNewFolderInput: boolean;

  // Selection mode state (for bulk operations)
  selectionMode: boolean;
  selectedVideoIds: string[];
  selectedFolderIds: string[];

  // Range selection state
  lastClickedItemId: string | null;  // Anchor for Shift+Click
  itemOrder: string[];  // Flat list of item IDs in display order (prefix: v_ for videos, f_ for folders)

  // Actions
  toggleSidebar: () => void;
  setActiveRightPanel: (panel: RightPanelId) => void;
  toggleRightPanel: (panel: RightPanelId) => void;
  toggleRightPanelMinimized: () => void;
  expandRightPanelToTab: (panel: RightPanelId) => void;
  setSidebarWidth: (width: number) => void;
  setActiveSection: (section: ActiveSection) => void;
  setSelectedFolder: (id: string | null) => void;
  toggleFolderExpansion: (folderId: string) => void;
  expandFolder: (folderId: string) => void;
  collapseFolder: (folderId: string) => void;
  collapseAllFolders: () => void;
  isFolderExpanded: (folderId: string) => boolean;
  setShowNewFolderInput: (show: boolean) => void;
  setSidebarTextSize: (size: SidebarTextSize) => void;
  setSidebarSortOption: (option: SortOption) => void;
  setSidebarSearchQuery: (query: string) => void;
  clearSidebarSearch: () => void;

  // Selection mode actions
  enterSelectionMode: (initialVideoId?: string, initialFolderId?: string) => void;
  exitSelectionMode: () => void;
  toggleVideoSelection: (videoId: string) => void;
  toggleFolderSelection: (folderId: string) => void;
  clearSelection: () => void;
  isVideoSelected: (videoId: string) => boolean;
  isFolderSelected: (folderId: string) => boolean;

  // Range selection actions
  setItemOrder: (items: string[]) => void;
  handleVideoSelection: (videoId: string, shiftKey: boolean, ctrlKey: boolean) => void;
  handleFolderSelection: (folderId: string, shiftKey: boolean, ctrlKey: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarOpen: true,
      activeRightPanel: "chapters" as RightPanelId,
      isRightPanelMinimized: false,
      sidebarWidth: 360,
      activeSection: "summarized",
      selectedFolderId: null,
      expandedFolderIds: [],
      sidebarTextSize: "medium",
      sidebarSortOption: "name-asc",
      sidebarSearchQuery: "",
      showNewFolderInput: false,

      // Selection mode state
      selectionMode: false,
      selectedVideoIds: [],
      selectedFolderIds: [],

      // Range selection state
      lastClickedItemId: null,
      itemOrder: [],

      // Actions
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),
      toggleRightPanel: (panel) => set((s) => ({
        activeRightPanel: s.activeRightPanel === panel ? "none" : panel,
      })),
      toggleRightPanelMinimized: () => set((s) => ({
        isRightPanelMinimized: !s.isRightPanelMinimized,
      })),
      expandRightPanelToTab: (panel) => set({
        activeRightPanel: panel,
        isRightPanelMinimized: false,
      }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setActiveSection: (section) => set({ activeSection: section, showNewFolderInput: false }),
      setSelectedFolder: (id) => set({ selectedFolderId: id }),
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
      setShowNewFolderInput: (show) => set({ showNewFolderInput: show }),
      setSidebarTextSize: (size) => set({ sidebarTextSize: size }),
      setSidebarSortOption: (option) => set({ sidebarSortOption: option }),
      setSidebarSearchQuery: (query) => set({ sidebarSearchQuery: query }),
      clearSidebarSearch: () => set({ sidebarSearchQuery: "" }),

      // Selection mode actions
      enterSelectionMode: (initialVideoId, initialFolderId) =>
        set({
          selectionMode: true,
          selectedVideoIds: initialVideoId ? [initialVideoId] : [],
          selectedFolderIds: initialFolderId ? [initialFolderId] : [],
        }),
      exitSelectionMode: () =>
        set({
          selectionMode: false,
          selectedVideoIds: [],
          selectedFolderIds: [],
        }),
      toggleVideoSelection: (videoId) =>
        set((s) => {
          const ids = s.selectedVideoIds;
          if (ids.includes(videoId)) {
            return { selectedVideoIds: ids.filter((id) => id !== videoId) };
          } else {
            return { selectedVideoIds: [...ids, videoId] };
          }
        }),
      toggleFolderSelection: (folderId) =>
        set((s) => {
          const ids = s.selectedFolderIds;
          if (ids.includes(folderId)) {
            return { selectedFolderIds: ids.filter((id) => id !== folderId) };
          } else {
            return { selectedFolderIds: [...ids, folderId] };
          }
        }),
      clearSelection: () =>
        set({ selectedVideoIds: [], selectedFolderIds: [] }),
      isVideoSelected: (videoId) => get().selectedVideoIds.includes(videoId),
      isFolderSelected: (folderId) => get().selectedFolderIds.includes(folderId),

      // Range selection actions
      setItemOrder: (items) => set({ itemOrder: items }),

      handleVideoSelection: (videoId, shiftKey, ctrlKey) => {
        const state = get();
        const itemId = `v_${videoId}`;

        // If not in selection mode, enter it
        if (!state.selectionMode) {
          set({
            selectionMode: true,
            selectedVideoIds: [videoId],
            selectedFolderIds: [],
            lastClickedItemId: itemId,
          });
          return;
        }

        // Shift+Click: range selection
        if (shiftKey && state.lastClickedItemId && state.itemOrder.length > 0) {
          const result = computeRangeSelection(
            state.itemOrder,
            state.lastClickedItemId,
            itemId,
            ctrlKey, // preserveExisting
            state.selectedVideoIds,
            state.selectedFolderIds
          );
          if (result) {
            set({
              selectedVideoIds: result.videoIds,
              selectedFolderIds: result.folderIds,
            });
            return;
          }
        }

        // Ctrl+Click: toggle selection
        if (ctrlKey) {
          const ids = state.selectedVideoIds;
          if (ids.includes(videoId)) {
            set({
              selectedVideoIds: ids.filter((id) => id !== videoId),
              lastClickedItemId: itemId,
            });
          } else {
            set({
              selectedVideoIds: [...ids, videoId],
              lastClickedItemId: itemId,
            });
          }
          return;
        }

        // Normal click: single selection
        set({
          selectedVideoIds: [videoId],
          selectedFolderIds: [],
          lastClickedItemId: itemId,
        });
      },

      handleFolderSelection: (folderId, shiftKey, ctrlKey) => {
        const state = get();
        const itemId = `f_${folderId}`;

        // If not in selection mode, enter it
        if (!state.selectionMode) {
          set({
            selectionMode: true,
            selectedVideoIds: [],
            selectedFolderIds: [folderId],
            lastClickedItemId: itemId,
          });
          return;
        }

        // Shift+Click: range selection
        if (shiftKey && state.lastClickedItemId && state.itemOrder.length > 0) {
          const result = computeRangeSelection(
            state.itemOrder,
            state.lastClickedItemId,
            itemId,
            ctrlKey, // preserveExisting
            state.selectedVideoIds,
            state.selectedFolderIds
          );
          if (result) {
            set({
              selectedVideoIds: result.videoIds,
              selectedFolderIds: result.folderIds,
            });
            return;
          }
        }

        // Ctrl+Click: toggle selection
        if (ctrlKey) {
          const ids = state.selectedFolderIds;
          if (ids.includes(folderId)) {
            set({
              selectedFolderIds: ids.filter((id) => id !== folderId),
              lastClickedItemId: itemId,
            });
          } else {
            set({
              selectedFolderIds: [...ids, folderId],
              lastClickedItemId: itemId,
            });
          }
          return;
        }

        // Normal click: single selection
        set({
          selectedVideoIds: [],
          selectedFolderIds: [folderId],
          lastClickedItemId: itemId,
        });
      },
    }),
    {
      name: "vie-ui-store",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        activeRightPanel: state.activeRightPanel,
        isRightPanelMinimized: state.isRightPanelMinimized,
        sidebarWidth: state.sidebarWidth,
        activeSection: state.activeSection,
        expandedFolderIds: state.expandedFolderIds,
        sidebarTextSize: state.sidebarTextSize,
        sidebarSortOption: state.sidebarSortOption,
      }),
    }
  )
);

// Selectors
export const useSidebarOpen = () => useUIStore((s) => s.sidebarOpen);
export const useActiveRightPanel = () => useUIStore((s) => s.activeRightPanel);
export const useIsRightPanelOpen = () => useUIStore((s) => s.activeRightPanel !== "none");
export const useIsRightPanelMinimized = () => useUIStore((s) => s.isRightPanelMinimized);
export const useSelectedFolder = () => useUIStore((s) => s.selectedFolderId);
export const useActiveSection = () => useUIStore((s) => s.activeSection);
export const useSidebarTextSize = () => useUIStore((s) => s.sidebarTextSize);
export const useSidebarSortOption = () => useUIStore((s) => s.sidebarSortOption);
export const useSidebarSearchQuery = () => useUIStore((s) => s.sidebarSearchQuery);
// Selection mode selectors
export const useSelectionMode = () => useUIStore((s) => s.selectionMode);
export const useSelectedVideoIds = () => useUIStore((s) => s.selectedVideoIds);
export const useSelectedFolderIds = () => useUIStore((s) => s.selectedFolderIds);
export const useSelectionCount = () =>
  useUIStore((s) => s.selectedVideoIds.length + s.selectedFolderIds.length);
