import { request } from "./client";
import type { AuthResponse, User } from "@/types";

// API layer - pure HTTP calls, no side effects
// Callers are responsible for token management via setAccessToken
export const authApi = {
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<void> {
    return request("/auth/logout", { method: "POST" });
  },

  async getMe(): Promise<User> {
    return request<User>("/auth/me");
  },
};
