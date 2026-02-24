import axios from "axios";
import { PRO_MONTHLY_PRICE } from "@/constants/pricing";
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveAuthSession,
} from "@/lib/authStorage";

const rawApiUrl = import.meta.env.VITE_API_URL ?? "/api";
// Avoid using localhost/127.0.0.1 when app is served from another origin (e.g. Vercel)
const isLocalHost =
  typeof rawApiUrl === "string" &&
  (rawApiUrl.startsWith("http://127.0.0.1") || rawApiUrl.startsWith("http://localhost"));
const isDifferentOrigin =
  typeof window !== "undefined" &&
  !window.location.hostname.includes("localhost") &&
  window.location.hostname !== "127.0.0.1";
const apiBaseUrl = (isLocalHost && isDifferentOrigin ? "/api" : rawApiUrl).replace(/\/$/, "");

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120_000,
});

let refreshPromise: Promise<string> | null = null;

interface RetryableConfig {
  _retry?: boolean;
  headers?: Record<string, string>;
  url?: string;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${apiBaseUrl}/auth/refresh`, { refresh_token: refreshToken })
      .then((resp) => {
        const data = resp.data as {
          access_token: string;
          refresh_token: string;
          user: {
            id: string;
            email: string;
            display_name: string;
            avatar_url: string | null;
            bio: string;
            tier: "free" | "pro";
            subscription_status: string;
            email_verified: boolean;
            is_admin: boolean;
            is_active: boolean;
            created_at: string | null;
            updated_at: string | null;
          };
        };
        saveAuthSession({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: data.user,
        });
        return data.access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const message = error?.response?.data?.error as string | undefined;
    const original = (error.config ?? {}) as RetryableConfig;

    if (status === 403 && message && message.toLowerCase().includes("free tier limit")) {
      const { toast } = await import("sonner");
      toast.error("You've hit your free limit", {
        description: `Upgrade to Pro for unlimited access -- just ${PRO_MONTHLY_PRICE}/mo. ${message}`,
        action: {
          label: "Upgrade",
          onClick: () => {
            window.location.href = "/pricing";
          },
        },
      });
    }

    const isAuthRoute = (original.url ?? "").includes("/auth/");
    if (status === 401 && !original._retry && !isAuthRoute) {
      try {
        original._retry = true;
        const freshToken = await refreshAccessToken();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${freshToken}`;
        return api(original as Parameters<typeof api>[0]);
      } catch {
        clearAuthSession();
        if (window.location.pathname !== "/login") {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
      }
    }

    if (status === 401 && isAuthRoute) {
      const user = getStoredUser();
      if (user) {
        clearAuthSession();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
