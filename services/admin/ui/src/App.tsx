import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hasApiKey } from './lib/api';
import { LoginPrompt } from './components/LoginPrompt';
import { DashboardPage } from './pages/DashboardPage';
import { UsagePage } from './pages/UsagePage';
import { HealthPage } from './pages/HealthPage';
import { AlertsPage } from './pages/AlertsPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/usage', label: 'Usage' },
  { to: '/health', label: 'Health' },
  { to: '/alerts', label: 'Alerts' },
];

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-6">
          <span className="font-bold text-sm">VIE Admin</span>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-dim)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
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
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
