import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserCosts, useUserCostDetail } from '../hooks/use-admin-api';
import { api, type UserCostRow } from '../lib/api';
import { formatCost, formatNumber, timeAgo } from '../lib/format';
import { Panel } from '../components/Panel';
import { SkeletonPanel } from '../components/SkeletonPanel';
import { ErrorState } from '../components/ErrorState';

interface UsersPageProps {
  days?: number;
}

type SortKey = 'effectiveUsd' | 'totalCostUsd' | 'videoCount' | 'creditAdjustmentUsd';

function compareRows(a: UserCostRow, b: UserCostRow, key: SortKey): number {
  return (a[key] ?? 0) - (b[key] ?? 0);
}

function tierBadge(tier: string): string {
  switch (tier) {
    case 'pro':
      return 'bg-[var(--color-success-soft)] text-[var(--color-success)]';
    case 'team':
      return 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]';
    default:
      return 'bg-[var(--color-surface-dim)] text-[var(--color-text-muted)]';
  }
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export function UsersPage({ days = 7 }: UsersPageProps = {}) {
  const { data, isLoading, isError, error, refetch } = useUserCosts(days, 100);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('effectiveUsd');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<UserCostRow | null>(null);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? data.filter((u) =>
          (u.email ?? '').toLowerCase().includes(needle)
          || (u.name ?? '').toLowerCase().includes(needle)
          || u.userId.toLowerCase().includes(needle),
        )
      : data;
    const sign = sortDir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => compareRows(a, b, sortKey) * sign);
  }, [data, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Users</h2>
        <ErrorState error={error} onRetry={() => refetch()} title="Failed to load user costs" />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Users</h2>
        <SkeletonPanel size="sm" count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Users by cost</h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {visible.length} of {data.length} users (last {days} days)
        </span>
      </div>

      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by email, name, or id…"
        aria-label="Filter users"
        data-testid="users-filter"
        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />

      <Panel tone="raised" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dim)]">
                <th className="text-left p-3">User</th>
                <th className="text-left p-3 hidden sm:table-cell">Tier</th>
                <SortableTh label="Effective" active={sortKey === 'effectiveUsd'} dir={sortDir} onClick={() => toggleSort('effectiveUsd')} />
                <SortableTh label="Raw" active={sortKey === 'totalCostUsd'} dir={sortDir} onClick={() => toggleSort('totalCostUsd')} />
                <SortableTh label="Credit" active={sortKey === 'creditAdjustmentUsd'} dir={sortDir} onClick={() => toggleSort('creditAdjustmentUsd')} />
                <SortableTh label="Videos" active={sortKey === 'videoCount'} dir={sortDir} onClick={() => toggleSort('videoCount')} />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-[var(--color-text-muted)]">
                    No users with usage in the last {days} days.
                  </td>
                </tr>
              ) : (
                visible.map((u) => (
                  <tr
                    key={u.userId}
                    onClick={() => setSelectedUser(u)}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-dim)] cursor-pointer transition-colors"
                    data-testid={`user-row-${u.userId}`}
                  >
                    <td className="p-3 min-w-0">
                      <div className="font-medium text-[var(--color-text)] truncate max-w-[260px]">
                        {u.email ?? u.name ?? shortId(u.userId)}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-faint)] font-mono truncate">
                        {shortId(u.userId)}
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${tierBadge(u.tier)}`}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[var(--color-primary)]">
                      {formatCost(u.effectiveUsd)}
                    </td>
                    <td className="p-3 text-right font-mono">{formatCost(u.totalCostUsd)}</td>
                    <td
                      className="p-3 text-right font-mono"
                      style={{ color: u.creditAdjustmentUsd < 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                    >
                      {formatCost(u.creditAdjustmentUsd)}
                    </td>
                    <td className="p-3 text-right">{formatNumber(u.videoCount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

interface SortableThProps {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}

function SortableTh({ label, active, dir, onClick }: SortableThProps) {
  return (
    <th className="text-right p-3">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
      >
        {label}
        <span aria-hidden="true">{active ? (dir === 'desc' ? '↓' : '↑') : ''}</span>
      </button>
    </th>
  );
}

interface UserDetailDrawerProps {
  user: UserCostRow;
  onClose: () => void;
}

function UserDetailDrawer({ user, onClose }: UserDetailDrawerProps) {
  const { data, isLoading, isError, error, refetch } = useUserCostDetail(user.userId, 30);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="User cost detail"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{user.email ?? user.name ?? shortId(user.userId)}</h3>
            <p className="text-[10px] font-mono text-[var(--color-text-faint)] truncate">{user.userId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-dim)]"
            aria-label="Close"
          >
            Close
          </button>
        </header>

        <div className="p-4 space-y-4">
          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} title="Failed to load user detail" />
          ) : isLoading || !data ? (
            <SkeletonPanel size="sm" count={3} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile label="Effective" value={formatCost(data.user.effectiveUsd)} highlight />
                <StatTile label="Raw" value={formatCost(data.user.totalCostUsd)} />
                <StatTile label="Credit" value={formatCost(data.user.creditAdjustmentUsd)} />
                <StatTile label="Videos" value={formatNumber(data.user.videoCount)} />
              </div>

              <GrantCreditForm userId={user.userId} />

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Daily breakdown
                </h4>
                {data.daily.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">No usage in the window.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[var(--color-surface-dim)]">
                        <tr>
                          <th className="p-2 text-left font-medium">Date</th>
                          <th className="p-2 text-right font-medium">Effective</th>
                          <th className="p-2 text-right font-medium">Raw</th>
                          <th className="p-2 text-right font-medium">Credit</th>
                          <th className="p-2 text-right font-medium">Videos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map((row) => (
                          <tr key={row.date} className="border-t border-[var(--color-border)]">
                            <td className="p-2">{row.date}</td>
                            <td className="p-2 text-right font-mono font-medium text-[var(--color-primary)]">
                              {formatCost(row.effectiveUsd)}
                            </td>
                            <td className="p-2 text-right font-mono">{formatCost(row.totalCostUsd)}</td>
                            <td className="p-2 text-right font-mono">{formatCost(row.creditAdjustmentUsd)}</td>
                            <td className="p-2 text-right">{formatNumber(row.videoCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Recent adjustments
                </h4>
                {data.adjustments.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">No grants or manual adjustments yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.adjustments.map((adj) => {
                      // Storage convention: negative = credit, positive = charge.
                      // Re-frame for display so the admin reads the intent, not the sign.
                      const isCredit = adj.amountUsd < 0;
                      const magnitude = Math.abs(adj.amountUsd);
                      return (
                        <li
                          key={adj.id}
                          className="flex items-center justify-between p-2 rounded border border-[var(--color-border)] text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-[var(--color-text-muted)]">
                              {adj.date} · {timeAgo(adj.createdAt)}
                            </div>
                            <div className="truncate max-w-[300px] text-[var(--color-text)]">{adj.reason}</div>
                          </div>
                          <span
                            className="font-mono font-bold"
                            style={{ color: isCredit ? 'var(--color-success)' : 'var(--color-warning)' }}
                            title={`Stored as ${formatCost(adj.amountUsd)} (negative = credit)`}
                          >
                            {isCredit ? `Credit ${formatCost(magnitude)}` : `Charge ${formatCost(magnitude)}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-dim)] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">{label}</div>
      <div
        className={`mt-1 font-mono text-sm font-semibold ${highlight ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}
      >
        {value}
      </div>
    </div>
  );
}

interface GrantCreditFormProps {
  userId: string;
}

function GrantCreditForm({ userId }: GrantCreditFormProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [adminId, setAdminId] = useState(() => localStorage.getItem('admin_user_id') ?? '');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = Number.parseFloat(amount);
      if (!Number.isFinite(parsed)) throw new Error('Enter a numeric USD amount');
      if (!reason.trim()) throw new Error('Reason is required');
      if (adminId.trim().length !== 24) throw new Error('Admin id must be a 24-char ObjectId');
      return api.users.grantCredit(userId, {
        amountUsd: parsed,
        reason: reason.trim(),
        adminId: adminId.trim(),
      });
    },
    onSuccess: () => {
      localStorage.setItem('admin_user_id', adminId.trim());
      setMessage({ kind: 'ok', text: 'Adjustment recorded.' });
      setAmount('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['user-cost-detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-costs'] });
    },
    onError: (e: Error) => setMessage({ kind: 'err', text: e.message }),
  });

  return (
    <form
      className="space-y-2 rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface-dim)]"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        mutation.mutate();
      }}
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Grant credit / adjust
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="number"
          step="0.01"
          min="-100"
          max="100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="USD (positive = credit)"
          aria-label="USD amount"
          data-testid="grant-credit-amount"
          className="px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (audited)"
          aria-label="Reason"
          data-testid="grant-credit-reason"
          maxLength={500}
          className="px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs"
        />
        <input
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          placeholder="Admin user id"
          aria-label="Admin user id"
          data-testid="grant-credit-admin-id"
          maxLength={24}
          className="px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs font-medium disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Apply adjustment'}
        </button>
        {message && (
          <span
            className="text-xs"
            style={{ color: message.kind === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}
            role="status"
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
