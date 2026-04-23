import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { App } from "./App";

// Self-hosted fonts via @fontsource — replaces the Google Fonts <link> in
// index.html. Reasons: (1) regions that block Google Fonts silently fall
// back to system-ui (often Inter), collapsing the anti-reflex font choice
// the design system depends on; (2) no cross-origin round-trip on first
// paint; (3) no external privacy dependency for the typography layer.
// Weights mirror the prior Google Fonts request exactly.
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/bricolage-grotesque/500.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "./index.css";

// Dev-console greeting — prints once per session in production only, so repeated
// DevTools opens during triage don't bury real errors. Plain text — no gradient
// chrome — to avoid the AI-banner look we deliberately design against.
if (!import.meta.env.DEV && typeof window !== "undefined") {
  try {
    const KEY = "vie:console-greeted";
    if (!window.sessionStorage.getItem(KEY)) {
      console.log(
        "VIE — Video Insight Engine\nPaste a YouTube URL to turn it into a structured knowledge app.",
      );
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
