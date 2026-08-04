import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginWithToken } from "@/lib/auth";
import { useLocale } from "@/hooks/useLocale";

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
      navigate("/login", { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      {t.login.submitting}
    </div>
  );
}
