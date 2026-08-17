import axios from "axios";
import { SAAS_FRONT_URL } from "@/lib/constants";

// Saas Back mounts routes at the root (no /api prefix), unlike the original
// pnl-backend. Point VITE_API_URL at the Saas Back deployment.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  // Lets Saas Back scope newly-created rows to this specific service —
  // see src/lib/scope.ts's serviceFilter() on the backend.
  headers: { "Content-Type": "application/json", "X-Service-Key": "pnl-app" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth now lives in Saas Front — bounce an expired/invalid session back
// there instead of to this app's own (unused) /login page.

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = `${SAAS_FRONT_URL}/login`;
    }
    return Promise.reject(err);
  }
);

export default api;
