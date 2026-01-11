const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const REQUEST_TIMEOUT_MS = 30000;

class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// Single source of truth for token - localStorage only (no in-memory duplicate)
export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem("accessToken");
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) return false;

    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch (error) {
    console.error("Token refresh failed:", error);
    return false;
  }
}

export async function request<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal },
  _isRetry = false
): Promise<T> {
  const token = getAccessToken();

  // Create timeout controller if no external signal provided
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal = options?.signal || controller.signal;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
      credentials: "include",
    });

    clearTimeout(timeoutId);

    // Handle 401 - try refresh (only once to prevent infinite recursion)
    if (res.status === 401 && token && !_isRetry) {
      const refreshed = await refreshToken();
      if (refreshed) {
        return request(endpoint, options, true);
      }
      setAccessToken(null);
    }

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: "Request failed" }));
      throw new ApiError(res.status, error.message, error.error);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(408, "Request timeout", "TIMEOUT");
    }
    throw error;
  }
}

export { ApiError };
