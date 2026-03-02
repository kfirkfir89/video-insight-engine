import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hasApiKey } from './lib/api';
import { LoginPrompt } from './components/LoginPrompt';
import { DashboardPage } from './pages/DashboardPage';
import { UsagePage } from './pages/UsagePage';
import { HealthPage } from './pages/HealthPage';
import { AlertsPage } from './pages/AlertsPage';
import { VideosPage } from './pages/VideosPage';
import { VideoDetailPage } from './pages/VideoDetailPage';
import { GridIcon, VideoIcon, BarChartIcon, HeartPulseIcon, BellIcon } from './components/icons';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

const navItems = [
  { to: '/', label: 'Dashboard', icon: GridIcon },
  { to: '/videos', label: 'Videos', icon: VideoIcon },
  { to: '/usage', label: 'Usage', icon: BarChartIcon },
  { to: '/health', label: 'Health', icon: HeartPulseIcon },
  { to: '/alerts', label: 'Alerts', icon: BellIcon },
];

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-4">
          <span className="font-bold text-sm tracking-tight">VIE Admin</span>
          <div className="w-px h-5 bg-[var(--color-border)]" />
          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-dim)]'
                    }`
                  }
                >
                  <Icon />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(hasApiKey());

  if (!authed) {
    return <LoginPrompt onLogin={() => setAuthed(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/videos/:videoId" element={<VideoDetailPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
