import { request, setAccessToken } from "./client";
import type { AuthResponse, User } from "@/types";

export const authApi = {
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async logout(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
    setAccessToken(null);
  },

  async getMe(): Promise<User> {
    return request<User>("/auth/me");
  },
};
