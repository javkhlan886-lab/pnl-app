// Hardcoded, not read from VITE_SAAS_FRONT_URL: that env var has repeatedly
// drifted out of sync on Vercel (still pointing at the retired
// saas-front-livid.vercel.app), silently breaking cross-app redirects. This
// is the one stable production domain, centralized here so the 3 previously
// duplicated copies of this constant (and comment) can't drift from each other.
export const SAAS_FRONT_URL = "https://product.gurvandelger.com";
