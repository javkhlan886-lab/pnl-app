import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useAuth } from "@/hooks/useAuth";
import { getCompanyUsers, changePnlLevel } from "@/lib/admin";
import { logout } from "@/lib/auth";
import { useLocale, format } from "@/hooks/useLocale";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
  ArrowLeftRight, TableIcon, HardHat, Handshake, Package,
} from "lucide-react";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { company, isAdmin, loading: authLoading, user } = useAuth();
  const { t } = useLocale();
  const layoutMode = useLayoutMode();

  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<User | null>(null);
  const [assignPicked, setAssignPicked] = useState<Set<string>>(new Set());

  const LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
    1: t.admin.level1,
    2: t.admin.level2,
    3: t.admin.level3,
    4: t.admin.level4,
  };

  const NAV_ITEMS = [
    { path: "/dashboard", label: t.common.navDashboard, icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/products", label: t.common.navProducts, icon: <Package className="w-4 h-4" /> },
    { path: "/transactions", label: t.common.navTransactions, icon: <TableIcon className="w-4 h-4" /> },
    { path: "/employees", label: t.common.navEmployees, icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: t.common.navAssets, icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: t.common.navExpenses, icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: t.common.navReceivables, icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/workforce", label: t.common.navWorkforce, icon: <HardHat className="w-4 h-4" /> },
    { path: "/partners", label: t.common.navPartners, icon: <Handshake className="w-4 h-4" /> },
    { path: "/admin/users", label: t.common.navAdmin, icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  useEffect(() => {
    if (!company) return;
    getCompanyUsers(company.id)
      .then(setUsers)
      .catch(() => setError(t.admin.loadError));
  }, [company, t]);

  async function applyLevel(target: User, level: 1 | 2 | 3 | 4, viewableUserIds?: string[]) {
    setSavingId(target.id);
    try {
      const updated = await changePnlLevel(target.id, level, viewableUserIds);
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
    } catch {
      setError(t.admin.saveError);
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

  const headerActions = (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <Button variant="ghost" size="sm" onClick={logout}>
        <LogOut className="w-4 h-4 mr-1.5" /> {t.common.logout}
      </Button>
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
    <div className={layoutMode === "sidebar" ? "flex" : ""}>
      {layoutMode === "sidebar" && (
        <Sidebar navItems={NAV_ITEMS} activePath={location.pathname} onNavigate={navigate}
          companyName={company?.name} productName={t.common.productName} userName={user?.name} liveLabel="LIVE" />
      )}
      <div className={layoutMode === "sidebar" ? "flex-1 min-w-0" : ""}>
      <header className="border-b border-border/50 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        {layoutMode === "sidebar" ? (
          <div>
            <h1 className="text-lg font-medium flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> {t.admin.title}
            </h1>
            <p className="text-xs text-muted-foreground">{t.admin.subtitle}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> {t.admin.title}
              </h1>
              <p className="text-xs text-muted-foreground">{t.admin.subtitle}</p>
            </div>
          </div>
        )}
        {headerActions}
      </header>

              <nav className={`border-b border-border/50 px-4 sm:px-6 overflow-x-auto ${layoutMode === "sidebar" ? "md:hidden" : ""}`}>
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

      <main className={layoutMode === "sidebar" ? "px-4 sm:px-6 py-6 sm:py-8" : "max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
        {!authLoading && !isAdmin ? (
          <p className="text-sm text-muted-foreground">{t.admin.noAccess}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{t.admin.description}</p>

            {error && <p className="text-sm text-destructive mb-3">{error}</p>}

            <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.colUser}</TableHead>
                  <TableHead>{t.admin.colRole}</TableHead>
                  <TableHead>{t.admin.colLevel}</TableHead>
                  <TableHead>{t.admin.colViewable}</TableHead>
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
                          <Badge variant="secondary">{t.admin.roleUser}</Badge>
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
                              ? format(t.admin.viewableCount, { count: String(u.pnlViewableUserIds.length) })
                              : t.admin.viewableNone
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {users && users.filter((u) => u.role === "company_user").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {t.admin.noUsers}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </main>
      </div>
    </div>

      <Dialog open={!!assignFor} onOpenChange={(open) => !open && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.admin.assignDialogTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {format(t.admin.assignDialogDesc, { name: assignFor?.name || assignFor?.email || "" })}
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
              <p className="text-xs text-muted-foreground">{t.admin.noOtherUsers}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFor(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={confirmAssign}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
