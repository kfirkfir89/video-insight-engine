import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { Sidebar } from "../Sidebar";
import { useProcessingStore } from "@/features/video-output/stores/processing-store";
import { useUIStore } from "@/stores/ui-store";

// Capture the arguments the Sidebar passes to useSidebarChat. The real hook is
// exercised elsewhere; here we only verify wiring of the active video id and
// the confirmation pass-through. Tests override `hookOverrides` to simulate a
// pending destructive-action confirmation.
const useSidebarChatMock = vi.fn();
const confirmPendingActionMock = vi.fn();
const cancelPendingActionMock = vi.fn();
// vi.mock factories are hoisted above module-scope declarations, so per-test
// overrides live behind a hoisted `.current` holder (mutated, never
// reassigned) to stay reachable from the factory.
const hookOverrides = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
vi.mock("@/features/sidebar/hooks/use-sidebar-chat", () => ({
  useSidebarChat: (options: unknown) => {
    useSidebarChatMock(options);
    return {
      messages: [],
      status: "idle" as const,
      pendingConfirmation: null,
      sendMessage: vi.fn(),
      confirmPendingAction: confirmPendingActionMock,
      cancelPendingAction: cancelPendingActionMock,
      clearMessages: vi.fn(),
      ...hookOverrides.current,
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
// Capture the props Sidebar hands the chat panel so confirmation wiring is
// asserted without rendering the real panel (covered by its own tests).
const ragChatPanelProps = vi.fn();
vi.mock("@/components/rag/RAGChatPanel", () => ({
  RAGChatPanel: (props: Record<string, unknown>) => {
    ragChatPanelProps(props);
    return null;
  },
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

  describe("pending confirmation pass-through", () => {
    afterEach(() => {
      hookOverrides.current = {};
      ragChatPanelProps.mockClear();
      // The Sidebar can still be mounted here, so route the store reset
      // through act() to flush its re-render cleanly.
      act(() => {
        useUIStore.setState({ activeSection: "summarized" });
      });
    });

    it("should surface a pending confirmation to the chat panel", async () => {
      useUIStore.setState({ activeSection: "assistant" });
      hookOverrides.current = {
        pendingConfirmation: {
          token: "tok-123",
          action: "delete_folder",
          summary: "Delete this folder AND every video inside it",
        },
      };

      await renderSidebar();

      expect(ragChatPanelProps).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingAction: true,
          pendingSummary: "Delete this folder AND every video inside it",
          onConfirmAction: expect.any(Function),
          onCancelAction: expect.any(Function),
        }),
      );
    });

    it("should not flag a pending action when none exists", async () => {
      useUIStore.setState({ activeSection: "assistant" });

      await renderSidebar();

      expect(ragChatPanelProps).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingAction: false,
          pendingSummary: undefined,
        }),
      );
    });

    it("should hand the hook's confirm/cancel callbacks to the panel", async () => {
      useUIStore.setState({ activeSection: "assistant" });
      hookOverrides.current = {
        pendingConfirmation: {
          token: "tok-123",
          action: "generate_video",
          summary: "Generate a knowledge app",
        },
      };

      await renderSidebar();

      const props = ragChatPanelProps.mock.calls.at(-1)?.[0] as {
        onConfirmAction: () => void;
        onCancelAction: () => void;
      };
      props.onConfirmAction();
      props.onCancelAction();

      expect(confirmPendingActionMock).toHaveBeenCalledTimes(1);
      expect(cancelPendingActionMock).toHaveBeenCalledTimes(1);
    });
  });
});
