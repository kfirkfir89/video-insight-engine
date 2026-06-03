import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { Sidebar } from "../Sidebar";
import { useProcessingStore } from "@/features/video-output/stores/processing-store";

// Capture the arguments the Sidebar passes to useSidebarChat. The real hook is
// exercised elsewhere; here we only verify wiring of the active video id.
const useSidebarChatMock = vi.fn();
vi.mock("@/features/sidebar/hooks/use-sidebar-chat", () => ({
  useSidebarChat: (options: unknown) => {
    useSidebarChatMock(options);
    return {
      messages: [],
      status: "idle" as const,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
    };
  },
}));

// Stub the heavy children so the Sidebar renders in isolation without pulling
// in React Query data hooks, DnD context, or the RAG chat panel.
vi.mock("@/features/sidebar/core/SidebarHeader", () => ({
  SidebarHeader: () => null,
}));
vi.mock("@/features/sidebar/core/SidebarToolbar", () => ({
  SidebarToolbar: () => null,
}));
vi.mock("@/features/sidebar/core/SidebarTabs", () => ({
  SidebarTabs: () => null,
}));
vi.mock("@/features/sidebar/core/SidebarSection", () => ({
  SidebarSection: () => null,
}));
vi.mock("@/features/sidebar/core/SelectionToolbar", () => ({
  SelectionToolbar: () => null,
}));
vi.mock("@/features/sidebar/core/DndProvider", () => ({
  DndProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/rag/RAGChatPanel", () => ({
  RAGChatPanel: () => null,
}));
// Dev-only lazy panel — stub so its Suspense boundary doesn't emit an
// out-of-act state update during the test.
vi.mock("@/components/dev/DevToolPanel", () => ({
  DevToolPanel: () => null,
}));

async function renderSidebar() {
  // The Sidebar mounts a dev-only lazy() panel whose dynamic import resolves on
  // a later macrotask. Render and drain that promise inside act() so the
  // Suspense update is flushed rather than warning after the test body.
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return result;
}

describe("Sidebar", () => {
  afterEach(() => {
    useSidebarChatMock.mockClear();
    useProcessingStore.setState({ viewingVideoSummaryId: null });
  });

  it("should target the open video's assistant when a video is being viewed", async () => {
    useProcessingStore.setState({ viewingVideoSummaryId: "vs-1" });

    await renderSidebar();

    expect(useSidebarChatMock).toHaveBeenCalledWith({ videoSummaryId: "vs-1" });
  });

  it("should pass an undefined video id when no video is being viewed", async () => {
    useProcessingStore.setState({ viewingVideoSummaryId: null });

    await renderSidebar();

    expect(useSidebarChatMock).toHaveBeenCalledWith({ videoSummaryId: undefined });
  });
});
