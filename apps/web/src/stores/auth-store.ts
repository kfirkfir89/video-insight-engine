import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/api/auth";
import { setAccessToken } from "@/api/client";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email, password) => {
        const { user, accessToken } = await authApi.login(email, password);
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      register: async (email, password, name) => {
        const { user, accessToken } = await authApi.register(
          email,
          password,
          name
        );
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      logout: () => {
        authApi.logout().catch(() => {}); // Fire and forget
        setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          setAccessToken(accessToken);
          const user = await authApi.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          setAccessToken(null);
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: "vie-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    }
  )
);

// Selectors (prevent unnecessary re-renders)
export const useUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
