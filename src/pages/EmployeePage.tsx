import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "@/lib/employee";
import { toDateInputValue } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useLocale, format } from "@/hooks/useLocale";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LogOut, TableIcon, Plus, Pencil, Trash2, Users, ChevronLeft, BarChart2, Box, Receipt, ArrowLeftRight, Download, ShieldCheck, HardHat, Handshake, Package } from "lucide-react";

interface Employee {
  _id?: string;
  name: string;
  position: string;
  type: "engineer" | "staff";
  baseSalary: number;
  ndRate: number;
  ndshtRate: number;
  status: "active" | "leave" | "inactive";
  startDate: string;
}

const EMPTY: Employee = {
  name: "", position: "", type: "staff",
  baseSalary: 0, ndRate: 10, ndshtRate: 2,
  status: "active", startDate: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

function fmtInput(v: number) {
  return v === 0 ? "" : v.toLocaleString("mn-MN");
}

export default function EmployeePage() {
  const navigate = useNavigate();
  const { company, isAdmin } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();

  const statusLabel: Record<string, { label: string; cls: string }> = {
    active: { label: t.employees.statusActive, cls: "bg-positive/15 text-positive hover:bg-positive/15" },
    leave: { label: t.employees.statusLeave, cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
    inactive: { label: t.employees.statusInactive, cls: "bg-muted text-muted-foreground hover:bg-muted" },
  };

  const NAV_ITEMS = [
    { path: "/dashboard", label: t.common.navDashboard, icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: t.common.navEmployees, icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: t.common.navAssets, icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: t.common.navExpenses, icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: t.common.navReceivables, icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/workforce", label: t.common.navWorkforce, icon: <HardHat className="w-4 h-4" /> },
    { path: "/partners", label: t.common.navPartners, icon: <Handshake className="w-4 h-4" /> },
    { path: "/products", label: t.common.navProducts, icon: <Package className="w-4 h-4" /> },
    { path: "/transactions", label: t.common.navTransactions, icon: <TableIcon className="w-4 h-4" /> },
    ...(isAdmin ? [{ path: "/admin/users", label: t.common.navAdmin, icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [salaryDisplay, setSalaryDisplay] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setEmployees(await getEmployees()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalSalary = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary, 0);
  const totalND = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary * e.ndRate / 100, 0);
  const totalNdsht = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary * e.ndshtRate / 100, 0);
  const totalCost = totalSalary + totalND + totalNdsht;
  const engineerCount = employees.filter(e => e.type === "engineer").length;
  const staffCount = employees.filter(e => e.type === "staff").length;

  const openCreate = () => {
    setForm(EMPTY); setEditing(null);
    setSalaryDisplay(""); setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setForm({ ...emp, startDate: toDateInputValue(emp.startDate) }); setEditing(emp._id!);
    setSalaryDisplay(fmtInput(emp.baseSalary)); setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateEmployee(editing, form);
        setEmployees(prev => prev.map(e => e._id === editing ? updated : e));
      } else {
        const created = await createEmployee(form);
        setEmployees(prev => [created, ...prev]);
      }
      setOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.error || t.employees.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e._id !== id));
  };

  const nd = form.baseSalary * form.ndRate / 100;
  const ndsht = form.baseSalary * form.ndshtRate / 100;
  const totalFormCost = form.baseSalary + nd + ndsht;

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/employees/export?locale=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t.employees.exportError);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "employees.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { alert(t.dashboard.exportErrorAlert); }
    finally { setExporting(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
          <button onClick={() => navigate("/dashboard")}
            className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-medium flex items-center gap-2">
              <Users className="w-5 h-5" /> {t.employees.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.employees.pageSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? t.common.exportingLabel : t.common.excelExport}
          </Button>
          <Button onClick={openCreate} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> {t.employees.addEmployee}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1.5" /> {t.common.logout}
          </Button>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Module navigation */}
      <nav className="border-b border-border/50 px-4 sm:px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <button key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 my-2 text-xs rounded-full transition-colors whitespace-nowrap ${
                location.pathname === item.path
                  ? "nav-pill-active font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card glass-card-positive px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">{t.employees.statTotalEmployees}</p>
            <p className="relative stat-number text-2xl font-bold">{employees.length}</p>
            <p className="relative text-xs text-muted-foreground mt-1">
              {format(t.employees.statCountSub, { engineers: String(engineerCount), staff: String(staffCount) })}
            </p>
          </div>
          <div className="glass-card glass-card-negative px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">{t.employees.statTotalSalary}</p>
            <p className="relative stat-number text-2xl font-bold">{fmt(totalSalary)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.employees.monthly}</p>
          </div>
          <div className="glass-card glass-card-negative px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">{t.employees.statNdRate}</p>
            <p className="relative stat-number text-2xl font-bold">{fmt(totalND)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.employees.yearlyRate}</p>
          </div>
          <div className="glass-card glass-card-negative px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">{t.employees.statTotalCost}</p>
            <p className="relative stat-number text-2xl font-bold">{fmt(totalCost)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.employees.salaryPlusNd}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">{t.employees.noEmployees}</p>
            <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">
              {t.employees.addFirstEmployee}
            </Button>
          </div>
        ) : (
          <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>{t.employees.colName}</TableHead>
                  <TableHead>{t.employees.colPosition}</TableHead>
                  <TableHead>{t.employees.colType}</TableHead>
                  <TableHead className="text-right">{t.employees.colBaseSalary}</TableHead>
                  <TableHead className="text-right">{t.employees.colNd}</TableHead>
                  <TableHead className="text-right">{t.employees.colNdsht}</TableHead>
                  <TableHead className="text-right">{t.employees.colTotalCost}</TableHead>
                  <TableHead>{t.employees.colStatus}</TableHead>
                  <TableHead className="text-right">{t.employees.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => {
                  const nd = emp.baseSalary * emp.ndRate / 100;
                  const ndsht = emp.baseSalary * emp.ndshtRate / 100;
                  const total = emp.baseSalary + nd + ndsht;
                  const st = statusLabel[emp.status];
                  return (
                    <TableRow key={emp._id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell className="font-medium blur-number">{emp.name}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.position || "—"}</TableCell>
                      <TableCell>
                        <Badge className={emp.type === "engineer"
                          ? "bg-info/15 text-info hover:bg-info/15"
                          : "bg-muted text-muted-foreground hover:bg-muted"}>
                          {emp.type === "engineer" ? t.employees.typeEngineer : t.employees.typeStaff}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right stat-number">{fmt(emp.baseSalary)}</TableCell>
                      <TableCell className="text-right text-negative stat-number">{fmt(nd)}</TableCell>
                      <TableCell className="text-right text-negative stat-number">{fmt(ndsht)}</TableCell>
                      <TableCell className="text-right font-medium text-negative stat-number">{fmt(total)}</TableCell>
                      <TableCell>
                        <Badge className={st.cls}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"
                                className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {format(t.employees.deleteConfirmDesc, { name: emp.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(emp._id!)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {t.common.delete}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.employees.editEmployee : t.employees.addEmployee}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.name}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t.employees.namePlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.position}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  placeholder={t.employees.positionPlaceholder} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.type}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="engineer">{t.employees.typeEngineer}</option>
                  <option value="staff">{t.employees.typeStaff}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.status}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">{t.employees.statusActive}</option>
                  <option value="leave">{t.employees.statusLeave}</option>
                  <option value="inactive">{t.employees.statusInactive}</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t.employees.baseSalary}</label>
              <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                inputMode="numeric"
                value={salaryDisplay}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  const num = Number(raw) || 0;
                  setSalaryDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                  setForm(f => ({ ...f, baseSalary: num }));
                }}
                placeholder="0" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.ndRatePercent}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  type="number" min={0} max={100}
                  value={form.ndRate}
                  onChange={e => setForm(f => ({ ...f, ndRate: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.ndshtRatePercent}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  type="number" min={0} max={100}
                  value={form.ndshtRate}
                  onChange={e => setForm(f => ({ ...f, ndshtRate: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t.employees.startDate}</label>
              <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            {form.baseSalary > 0 && (
              <div className="bg-secondary/50 rounded-lg px-4 py-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t.employees.baseSalary.replace(" *", "")}</span>
                  <span className="blur-number">{fmt(form.baseSalary)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{format(t.employees.ndLabel, { rate: String(form.ndRate) })}</span>
                  <span className="text-negative blur-number">{fmt(nd)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{format(t.employees.ndshtLabel, { rate: String(form.ndshtRate) })}</span>
                  <span className="text-negative blur-number">{fmt(ndsht)}</span>
                </div>
                <div className="flex justify-between py-1 font-medium border-t border-border mt-1 pt-2">
                  <span>{t.employees.totalCost}</span>
                  <span className="text-negative blur-number">{fmt(totalFormCost)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="bg-positive text-background hover:bg-positive/90">
              {saving ? t.common.saving : editing ? t.common.save : t.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
