import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { App } from "./App";
import "./index.css";

// Dev-console greeting — prints once per session in production only, so repeated
// DevTools opens during triage don't bury real errors.
if (!import.meta.env.DEV && typeof window !== "undefined") {
  try {
    const KEY = "vie:console-greeted";
    if (!window.sessionStorage.getItem(KEY)) {
      const brand = "color: white; background: linear-gradient(135deg, oklch(58% 0.24 292), oklch(72% 0.18 25)); padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 14px;";
      const subtle = "color: oklch(58% 0.04 280); font-size: 12px; line-height: 1.5;";
      console.log("%c VIE ", brand);
      console.log("%cPoking around? You can paste a YouTube URL to turn it into a structured knowledge app.\nCurious about the build? Check the sources — this app is pipeline-first.", subtle);
      window.sessionStorage.setItem(KEY, "1");
    }
  } catch {
    // sessionStorage unavailable (private mode, sandbox) — skip the banner.
  }
}

// Hide loading overlay after React mounts
const hideLoadingOverlay = () => {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : 200;
    overlay.style.opacity = "0";
    overlay.style.transition = `opacity ${duration}ms ease-out`;
    setTimeout(() => overlay.remove(), duration);
  }
};

// Get root element with explicit null check
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element '#root' not found in document");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);

// Remove loading overlay after initial render
requestAnimationFrame(hideLoadingOverlay);
