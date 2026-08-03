import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoUrl from "@/public/logo.png";

const SAAS_FRONT_URL = import.meta.env.VITE_SAAS_FRONT_URL || "http://localhost:3000";

export default function LoginPage() {
  const navigate = useNavigate();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(loginForm.email, loginForm.password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Нэвтрэхэд алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Theme toggle — баруун дээд буланд */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Арын ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-positive/[0.08] blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-negative/[0.06] blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-[114px] h-[114px] flex items-center justify-center">
            <img src={logoUrl} className="w-[114px] h-[114px] object-contain" />
          </div>
          <div className="text-center">
          
            <p className="text-sm text-muted-foreground">P&L удирдлагын систем</p>
          </div>
        </div>

        <div className="glass-card px-6 py-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Имэйл</Label>
              <Input type="email" placeholder="example@mail.com" required
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Нууц үг</Label>
              <Input type="password" placeholder="••••••••" required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" className="w-full bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_30%,transparent)]" disabled={loading}>
              {loading ? "Нэвтэрч байна..." : "Нэвтрэх"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Компанийн бүртгэлгүй юу?{" "}
            <a href={`${SAAS_FRONT_URL}/signup`} className="font-medium text-foreground underline underline-offset-4">
              Saas Front дээр бүртгүүлэх
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
