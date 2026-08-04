import axios from "axios";

// Saas Back mounts routes at the root (no /api prefix), unlike the original
// pnl-backend. Point VITE_API_URL at the Saas Back deployment.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth now lives in Saas Front — bounce an expired/invalid session back
// there instead of to this app's own (unused) /login page. Hardcoded (not
// read from VITE_SAAS_FRONT_URL): that env var has repeatedly drifted out of
// sync on Vercel, silently breaking this redirect.
const SAAS_FRONT_URL = "https://product.gurvandelger.com";

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
