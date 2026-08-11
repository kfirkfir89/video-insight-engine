import { describe, it, expect, beforeEach } from "vitest";

import { useChatStore, type ChatMessage } from "./chat-store";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    role: "assistant",
    content: "hello",
    createdAt: "2026-06-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("chat-store", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], status: "idle" });
    localStorage.clear();
  });

  describe("setMessages", () => {
    it("should replace messages when given an array", () => {
      const msg = makeMessage();
      useChatStore.getState().setMessages([msg]);
      expect(useChatStore.getState().messages).toEqual([msg]);
    });

    it("should apply a functional updater against the previous messages", () => {
      const first = makeMessage({ id: "m1" });
      const second = makeMessage({ id: "m2", role: "user", content: "hi" });
      useChatStore.getState().setMessages([first]);

      useChatStore.getState().setMessages((prev) => [...prev, second]);

      expect(useChatStore.getState().messages.map((m) => m.id)).toEqual([
        "m1",
        "m2",
      ]);
    });
  });

  describe("setStatus", () => {
    it("should update the status", () => {
      useChatStore.getState().setStatus("streaming");
      expect(useChatStore.getState().status).toBe("streaming");
    });
  });

  describe("clearMessages", () => {
    it("should empty messages and reset status to idle", () => {
      useChatStore.setState({
        messages: [makeMessage()],
        status: "streaming",
      });

      useChatStore.getState().clearMessages();

      expect(useChatStore.getState().messages).toEqual([]);
      expect(useChatStore.getState().status).toBe("idle");
    });
  });

  describe("persistence", () => {
    it("should persist only messages, not status, under the vie-chat key", () => {
      useChatStore.getState().setMessages([makeMessage()]);
      useChatStore.getState().setStatus("streaming");

      const raw = localStorage.getItem("vie-chat");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.state.messages).toHaveLength(1);
      expect(parsed.state.status).toBeUndefined();
    });
  });

  describe("rehydrate sanitize", () => {
    it("should clear isStreaming on rehydrated messages", () => {
      // Seed storage with a message stuck mid-stream (as a nav-interrupted
      // reload would leave it), then rehydrate from it.
      const stored = {
        state: {
          messages: [makeMessage({ id: "interrupted", isStreaming: true })],
        },
        version: 0,
      };
      localStorage.setItem("vie-chat", JSON.stringify(stored));

      useChatStore.persist.rehydrate();

      const msg = useChatStore
        .getState()
        .messages.find((m) => m.id === "interrupted");
      expect(msg?.isStreaming).toBe(false);
    });
  });
});
