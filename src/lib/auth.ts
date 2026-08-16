import api from "./axios";
import { AuthResponse, User } from "@/types";
import { SAAS_FRONT_URL } from "@/lib/constants";

// Kept as a fallback for direct access — normal entry is via loginWithToken
// (handed off from Saas Front, which owns signup/company management now).
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
  if (data.token) localStorage.setItem("token", data.token);
  return data;
};

// Used by the /sso landing page: Saas Front already authenticated the user
// and hands the same Saas Back JWT straight to this app.
export const loginWithToken = (token: string) => {
  localStorage.setItem("token", token);
};

// Баталгаажуулах харилцах цонх дуудагч талд (LogoutButton) байрлана —
// энэ функц зөвхөн бодит гарах үйлдлийг гүйцэтгэнэ.
export const logout = () => {
  localStorage.removeItem("token");
  // Dynamic import ашиглах нь circular import-ээс сэргийлнэ (useAuth -> auth -> useAuth)
  import("@/hooks/useAuth").then(({ clearAuthCache }) => clearAuthCache());
  window.location.href = SAAS_FRONT_URL;
};

export const getToken = () => localStorage.getItem("token");
export const isLoggedIn = () => !!getToken();

export interface Company {
  id: string;
  name: string;
  status: string;
}

// GET /auth/me — Saas Back returns { user, company }, not a flat user object.
export const fetchMe = async (): Promise<{ user: User; company: Company | null }> => {
  const { data } = await api.get<{ user: User; company: Company | null }>("/auth/me");
  return data;
};