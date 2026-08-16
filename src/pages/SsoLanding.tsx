import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginWithToken } from "@/lib/auth";
import { useLocale } from "@/hooks/useLocale";
import { SAAS_FRONT_URL } from "@/lib/constants";

// Entry point for users arriving from Saas Front, which already
// authenticated them and hands off the same Saas Back JWT here.
export default function SsoLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLocale();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      loginWithToken(token);
      navigate("/dashboard", { replace: true });
    } else {
      // No token means this wasn't a real SSO handoff — bounce back to
      // Saas Front's login (matches axios.ts's 401 handler destination),
      // not this app's own unused local /login route.
      window.location.href = `${SAAS_FRONT_URL}/login`;
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      {t.login.submitting}
    </div>
  );
}
