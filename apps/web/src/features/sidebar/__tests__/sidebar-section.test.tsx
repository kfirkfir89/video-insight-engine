import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Hoisted holders so the vi.mock factories (hoisted above imports) can share
// state with the tests.
const { mockUseAllVideos, mockUseFolders, authState } = vi.hoisted(() => ({
  mockUseAllVideos: vi.fn(() => ({ data: undefined, isLoading: false })),
  mockUseFolders: vi.fn(() => ({ data: undefined, isLoading: false })),
  authState: { isAuthenticated: false },
}));

vi.mock('@/hooks/use-videos', () => ({ useAllVideos: mockUseAllVideos }));
vi.mock('@/hooks/use-folders', () => ({ useFolders: mockUseFolders }));
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector(authState),
}));
// No DndContext in this render tree — stub the droppable hook.
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ isOver: false, setNodeRef: vi.fn() }),
}));
vi.mock('@/features/sidebar/folders/FolderTree', () => ({ FolderTree: () => null }));
vi.mock('@/features/sidebar/videos/UnassignedVideosList', () => ({ UnassignedVideosList: () => null }));
vi.mock('@/features/sidebar/videos/VideoItem', () => ({ VideoItem: () => null }));

import { SidebarSection } from '@/features/sidebar/core/SidebarSection';

/**
 * Regression for the ungated useAllVideos/useFolders fetch (rtl.spec.ts
 * environmental failure): an unauthenticated mount must not fire the list
 * queries — CommandPalette and GeneratePage already gate on auth, and
 * SidebarSection must match.
 */
describe('SidebarSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disable the videos and folders queries when unauthenticated', () => {
    authState.isAuthenticated = false;
    render(<SidebarSection />);
    expect(mockUseAllVideos).toHaveBeenCalledWith({ enabled: false });
    expect(mockUseFolders).toHaveBeenCalledWith({ enabled: false });
  });

  it('should enable the videos and folders queries when authenticated', () => {
    authState.isAuthenticated = true;
    render(<SidebarSection />);
    expect(mockUseAllVideos).toHaveBeenCalledWith({ enabled: true });
    expect(mockUseFolders).toHaveBeenCalledWith({ enabled: true });
  });
});
