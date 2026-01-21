import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import App from "./App";
import "./index.css";

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
