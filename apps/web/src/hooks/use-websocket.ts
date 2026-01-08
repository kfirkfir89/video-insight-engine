import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { queryKeys } from "@/lib/query-keys";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000";

interface VideoStatusEvent {
  type: "video.status";
  payload: {
    videoSummaryId: string;
    userVideoId?: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress?: number;
    message?: string;
    error?: string | null;
  };
}

type WebSocketEvent = VideoStatusEvent;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WebSocketEvent;

        if (data.type === "video.status") {
          // Invalidate video queries to refetch fresh data
          queryClient.invalidateQueries({ queryKey: queryKeys.videos.lists() });

          // If we have a userVideoId, also invalidate that specific video
          if (data.payload.userVideoId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.videos.detail(data.payload.userVideoId),
            });
          }
        }
      } catch {
        // Ignore non-JSON messages like "connected"
      }
    },
    [queryClient]
  );

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws?token=${accessToken}`);

    ws.onopen = () => {
      console.log("[WS] Connected");
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log("[WS] Disconnected:", event.code);
      wsRef.current = null;

      // Reconnect after 3 seconds if still authenticated
      if (isAuthenticated && event.code !== 4001) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      console.log("[WS] Error");
    };

    wsRef.current = ws;
  }, [accessToken, isAuthenticated, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, accessToken, connect, disconnect]);

  return { connect, disconnect };
}
