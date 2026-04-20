import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPrompt } from './LoginPrompt';

describe('LoginPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export LoginPrompt component', () => {
    expect(typeof LoginPrompt).toBe('function');
  });

  it('should validate key against /health/services and call onLogin on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const onLogin = vi.fn();

    render(<LoginPrompt onLogin={onLogin} />);
    fireEvent.change(screen.getByPlaceholderText('Admin API Key'), { target: { value: 'good-key' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/health/services',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer good-key' }) })
    );
    expect(localStorage.getItem('admin_api_key')).toBe('good-key');
  });

  it('should show invalid key error on 401 and NOT store key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const onLogin = vi.fn();

    render(<LoginPrompt onLogin={onLogin} />);
    fireEvent.change(screen.getByPlaceholderText('Admin API Key'), { target: { value: 'bad-key' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/invalid api key/i)).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem('admin_api_key')).toBeNull();
  });

  it('should show network error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const onLogin = vi.fn();

    render(<LoginPrompt onLogin={onLogin} />);
    fireEvent.change(screen.getByPlaceholderText('Admin API Key'), { target: { value: 'any-key' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/couldn't reach the admin api/i)).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem('admin_api_key')).toBeNull();
  });

  it('should show Signing in... while validating', async () => {
    let resolveFetch: (value: { ok: boolean; status: number }) => void = () => {};
    const pending = new Promise<{ ok: boolean; status: number }>((r) => { resolveFetch = r; });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending));

    render(<LoginPrompt onLogin={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Admin API Key'), { target: { value: 'k' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /signing in/i })).toBeTruthy());
    resolveFetch({ ok: true, status: 200 });
  });

  it('should guard against double submit while a request is in flight', async () => {
    // Slow/never-resolving fetch to simulate in-flight request
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<LoginPrompt onLogin={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Admin API Key'), { target: { value: 'k' } });
    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    // Fire two rapid submits before fetch resolves
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
