import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import compression from "vite-plugin-compression";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    // Gzip compression - broad browser support
    compression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024, // Only compress files > 1KB
    }),
    // Brotli compression - better compression, modern browsers
    compression({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024,
    }),
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Use function-based manualChunks for proper dependency splitting
        manualChunks: ((id: string) => {
          // React core - must be in separate chunk
          if (id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react/") ||
              id.includes("node_modules/scheduler/")) {
            return "vendor-react";
          }
          // React Router - separate chunk
          if (id.includes("node_modules/react-router") ||
              id.includes("node_modules/@remix-run/router")) {
            return "vendor-router";
          }
          // Radix UI components
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-ui";
          }
          // TanStack Query
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }
          // DnD Kit
          if (id.includes("node_modules/@dnd-kit/")) {
            return "vendor-dnd";
          }
          // Icons - lucide
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          // Zod validation
          if (id.includes("node_modules/zod/")) {
            return "vendor-zod";
          }
          // Sonner toast notifications
          if (id.includes("node_modules/sonner/")) {
            return "vendor-sonner";
          }
          // Zustand state management
          if (id.includes("node_modules/zustand/")) {
            return "vendor-zustand";
          }
          // Shiki syntax highlighting (lazy-loaded)
          if (id.includes("node_modules/shiki/") || id.includes("node_modules/@shikijs/")) {
            return "vendor-shiki";
          }
        }),
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
