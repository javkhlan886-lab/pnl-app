import { useState, useEffect, useCallback } from "react";
import { fetchMe, isLoggedIn, type Company } from "@/lib/auth";
import { User } from "@/types";

// Sessions хооронд дахин дахин /auth/me дуудахгүйн тулд module-level cache.
// Хуудас бүрт useAuth() дуудах бүрт API дуудаж байх шаардлагагүй.
let cachedUser: User | null = null;
let cachedCompany: Company | null = null;
let inFlight: Promise<{ user: User; company: Company | null }> | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [company, setCompany] = useState<Company | null>(cachedCompany);
  const [loading, setLoading] = useState(!cachedUser && isLoggedIn());

  const refresh = useCallback(async () => {
    if (!isLoggedIn()) {
      setUser(null);
      setCompany(null);
      cachedUser = null;
      cachedCompany = null;
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      if (!inFlight) inFlight = fetchMe();
      const { user: u, company: c } = await inFlight;
      cachedUser = u;
      cachedCompany = c;
      setUser(u);
      setCompany(c);
      return u;
    } catch {
      cachedUser = null;
      cachedCompany = null;
      setUser(null);
      setCompany(null);
      return null;
    } finally {
      inFlight = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedUser && isLoggedIn()) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  return {
    user,
    company,
    loading,
    refresh,
    // Saas Back only has company_admin/company_user (no manager/viewer tier).
    isAdmin: user?.role === "company_admin",
    isManager: false,
    canEditAllData: user?.role === "company_admin",
  };
}

// Logout эсвэл role өөрчлөгдсөн үед cache цэвэрлэх
export function clearAuthCache() {
  cachedUser = null;
  cachedCompany = null;
  inFlight = null;
}