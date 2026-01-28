import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAuthStore } from "@/stores/auth-store";
import { useWebSocket } from "@/hooks/use-websocket";
import { useProcessingManager } from "@/hooks/use-processing-manager";
import { Loader2, AlertTriangle } from "lucide-react";

// Lazy load toast components - not needed for initial render
const Toaster = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({ default: m.Toaster }))
);
const toastModule = () => import("sonner");

// Lazy load route components for code splitting
const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage }))
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const VideoDetailPage = lazy(() =>
  import("@/pages/VideoDetailPage").then((m) => ({ default: m.VideoDetailPage }))
);

// Loading fallback for lazy-loaded routes with ARIA live region
function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">Loading page...</span>
    </div>
  );
}

// Error fallback for chunk loading failures
function ChunkLoadError() {
  const handleReload = () => window.location.reload();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Failed to load page</h1>
      <p className="text-muted-foreground max-w-md">
        There was a problem loading this page. This might be due to a network issue or a new version being deployed.
      </p>
      <button
        onClick={handleReload}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Reload Page
      </button>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return <RouteLoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const logoutReason = useAuthStore((s) => s.logoutReason);
  const clearLogoutReason = useAuthStore((s) => s.clearLogoutReason);

  // Connect to WebSocket for real-time updates
  useWebSocket();

  // Manage processing streams for all videos (auto-resume, sidebar sync)
  useProcessingManager();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Show toast when session expires and user is redirected to login
  useEffect(() => {
    if (logoutReason) {
      // Dynamically import toast to avoid bundling in initial load
      toastModule().then(({ toast }) => {
        toast.error(logoutReason);
      });
      clearLogoutReason();
    }
  }, [logoutReason, clearLogoutReason]);

  return (
    <ErrorBoundary fallback={<ChunkLoadError />}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/video/:id"
            element={
              <ProtectedRoute>
                <VideoDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vie-theme">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
