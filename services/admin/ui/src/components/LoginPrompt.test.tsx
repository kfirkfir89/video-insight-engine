import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPrompt } from './LoginPrompt';

function fillCredentials(email = 'admin@admin.com', password = 'Admin123') {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } });
}

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

  it('should POST credentials to /auth/login, store the token, and call onLogin', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'session-token', email: 'admin@admin.com', expires_in: 43200 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onLogin = vi.fn();

    render(<LoginPrompt onLogin={onLogin} />);
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      '/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'admin@admin.com', password: 'Admin123' }),
      })
    );
    expect(localStorage.getItem('admin_api_key')).toBe('session-token');
  });

  it('should show invalid credentials error on 401 and NOT store a token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const onLogin = vi.fn();

    render(<LoginPrompt onLogin={onLogin} />);
    fillCredentials('admin@admin.com', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem('admin_api_key')).toBeNull();
  });

  it('should show network error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const onLogin = vi.fn();

    render(<LoginPrompt onLogin={onLogin} />);
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/couldn't reach the admin api/i)).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem('admin_api_key')).toBeNull();
  });

  it('should show Signing in... while validating', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((r) => { resolveFetch = r; });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending));

    render(<LoginPrompt onLogin={vi.fn()} />);
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /signing in/i })).toBeTruthy());
    resolveFetch({ ok: true, status: 200, json: async () => ({ token: 't' }) });
  });

  it('should guard against double submit while a request is in flight', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<LoginPrompt onLogin={vi.fn()} />);
    fillCredentials();
    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should not submit when email or password is empty', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<LoginPrompt onLogin={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'admin@admin.com' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
