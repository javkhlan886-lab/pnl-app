import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useAuth } from "@/hooks/useAuth";
import { getCompanyUsers, changePnlLevel } from "@/lib/admin";
import { logout } from "@/lib/auth";
import { User } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  LogOut, ChevronLeft, ShieldCheck, BarChart2, Users, Box, Receipt,
  ArrowLeftRight, TableIcon,
} from "lucide-react";

const LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "Level 1 — Админ түвшин (бүх дата)",
  2: "Level 2 — Менежер (бүх дата)",
  3: "Level 3 — Хязгаарлагдмал харагч",
  4: "Level 4 — Энгийн хэрэглэгч (зөвхөн өөрийн)",
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { company, isAdmin, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<User | null>(null);
  const [assignPicked, setAssignPicked] = useState<Set<string>>(new Set());

  const NAV_ITEMS = [
    { path: "/dashboard", label: "P&L Тайлан", icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: "Ажилчид & Цалин", icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: "Хөрөнгө", icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: "Зардал", icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: "Зээл & Авлага", icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/transactions", label: "Гүйлгээний дэвтэр", icon: <TableIcon className="w-4 h-4" /> },
    { path: "/admin/users", label: "Админ", icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  useEffect(() => {
    if (!company) return;
    getCompanyUsers(company.id)
      .then(setUsers)
      .catch(() => setError("Хэрэглэгчдийг ачаалахад алдаа гарлаа."));
  }, [company]);

  async function applyLevel(target: User, level: 1 | 2 | 3 | 4, viewableUserIds?: string[]) {
    setSavingId(target.id);
    try {
      const updated = await changePnlLevel(target.id, level, viewableUserIds);
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
    } catch {
      setError("Түвшин хадгалахад алдаа гарлаа.");
    } finally {
      setSavingId(null);
    }
  }

  function handleLevelChange(target: User, value: string) {
    const level = Number(value) as 1 | 2 | 3 | 4;
    if (level === 3) {
      setAssignPicked(new Set(target.pnlViewableUserIds ?? []));
      setAssignFor(target);
      return;
    }
    applyLevel(target, level);
  }

  function confirmAssign() {
    if (!assignFor) return;
    applyLevel(assignFor, 3, Array.from(assignPicked));
    setAssignFor(null);
  }

  const otherUsers = (target: User) =>
    (users ?? []).filter((u) => u.id !== target.id && u.role === "company_user");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-medium flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Админ
            </h1>
            <p className="text-xs text-muted-foreground">Хэрэглэгчдийн PnL хандах түвшин</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1.5" /> Гарах
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <nav className="border-b border-border/50 px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 my-2 text-xs rounded-full transition-colors whitespace-nowrap ${
                location.pathname === item.path
                  ? "nav-pill-active font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!authLoading && !isAdmin ? (
          <p className="text-sm text-muted-foreground">
            Танд энэ хуудсанд хандах эрх байхгүй байна. Зөвхөн компанийн админ эрхтэй хэрэглэгч
            бусдын PnL хандах түвшинг тохируулж болно.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Компанийн энгийн хэрэглэгч бүрийн PnL дата хандах түвшинг энд тохируулна. Компанийн
              админ үргэлж бүх датаг хардаг тул доор жагсаагдахгүй.
            </p>

            {error && <p className="text-sm text-destructive mb-3">{error}</p>}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Хэрэглэгч</TableHead>
                  <TableHead>Эрх</TableHead>
                  <TableHead>PnL түвшин</TableHead>
                  <TableHead>Харах эрхтэй хэрэглэгчид</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? [])
                  .filter((u) => u.role === "company_user")
                  .map((u) => {
                    const level = (u.pnlLevel ?? 4) as 1 | 2 | 3 | 4;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Энгийн хэрэглэгч</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={String(level)}
                            onValueChange={(v) => handleLevelChange(u, v)}
                            disabled={savingId === u.id}
                          >
                            <SelectTrigger className="w-64">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {([1, 2, 3, 4] as const).map((lvl) => (
                                <SelectItem key={lvl} value={String(lvl)}>
                                  {LEVEL_LABEL[lvl]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {level === 3
                            ? u.pnlViewableUserIds?.length
                              ? `${u.pnlViewableUserIds.length} хэрэглэгч`
                              : "Хараахан сонгоогүй"
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {users && users.filter((u) => u.role === "company_user").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Энгийн хэрэглэгч алга байна.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </main>

      <Dialog open={!!assignFor} onOpenChange={(open) => !open && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Харах эрхтэй хэрэглэгчид</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {assignFor?.name || assignFor?.email} нь өөрийн датагаас гадна доор сонгосон
            хэрэглэгчдийн PnL датаг харах болно.
          </p>
          <div className="max-h-64 overflow-y-auto space-y-1.5 border rounded-md p-3">
            {assignFor &&
              otherUsers(assignFor).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignPicked.has(u.id)}
                    onChange={(e) => {
                      setAssignPicked((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(u.id);
                        else next.delete(u.id);
                        return next;
                      });
                    }}
                  />
                  {u.name || u.email}
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </label>
              ))}
            {assignFor && otherUsers(assignFor).length === 0 && (
              <p className="text-xs text-muted-foreground">Сонгох боломжтой өөр хэрэглэгч алга.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFor(null)}>
              Цуцлах
            </Button>
            <Button onClick={confirmAssign}>Хадгалах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
