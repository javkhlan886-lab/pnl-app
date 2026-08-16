import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "@/lib/employee";
import { toDateInputValue } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useLocale, format } from "@/hooks/useLocale";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LayoutToggleButton } from "@/components/LayoutToggleButton";
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
import {
  LogOut, TableIcon, Plus, Pencil, Trash2, Users, ChevronLeft, ChevronDown, BarChart2, Box, Receipt,
  ArrowLeftRight, Download, ShieldCheck, HardHat, Handshake, Package, Search,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { getRecent, addRecent } from "@/lib/recentValues";
import { toast } from "@/lib/toast";
import { setAiPageContext } from "@/lib/aiPageContext";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";

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

const PAGE_SIZE = 20;

type SortKey = "name" | "position" | "type" | "baseSalary" | "nd" | "ndsht" | "totalCost" | "status";

// Баганын толгой дээр дарахад ижил утгатай мөрүүд зэрэгцэн эрэмбэлэгдэж харагдана.
const sortValue = (e: Employee, key: SortKey): string | number => {
  switch (key) {
    case "name": return (e.name || "").toLowerCase();
    case "position": return (e.position || "").toLowerCase();
    case "type": return e.type;
    case "baseSalary": return e.baseSalary;
    case "nd": return e.baseSalary * e.ndRate / 100;
    case "ndsht": return e.baseSalary * e.ndshtRate / 100;
    case "totalCost": return e.baseSalary + e.baseSalary * e.ndRate / 100 + e.baseSalary * e.ndshtRate / 100;
    case "status": return e.status;
  }
};

export default function EmployeePage() {
  const navigate = useNavigate();
  const { company, isAdmin, user } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();
  const layoutMode = useLayoutMode();

  const statusLabel: Record<string, { label: string; cls: string }> = {
    active: { label: t.employees.statusActive, cls: "bg-positive/15 text-positive hover:bg-positive/15" },
    leave: { label: t.employees.statusLeave, cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
    inactive: { label: t.employees.statusInactive, cls: "bg-muted text-muted-foreground hover:bg-muted" },
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
    ...(isAdmin ? [{ path: "/admin/users", label: t.common.navAdmin, icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [salaryDisplay, setSalaryDisplay] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "engineer" | "staff">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "leave" | "inactive">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setEmployees(await getEmployees()); }
    catch { setError(t.employees.loadError); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!e.name.toLowerCase().includes(q) && !(e.position || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  let sortedFiltered = filtered;
  if (sortKey) {
    const withIdx = filtered.map(e => ({ e, v: sortValue(e, sortKey) }));
    withIdx.sort((a, b) => {
      const cmp = typeof a.v === "string" && typeof b.v === "string"
        ? a.v.localeCompare(b.v)
        : (a.v as number) - (b.v as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    sortedFiltered = withIdx.map(x => x.e);
  }

  const pageCount = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const pagedFiltered = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [typeFilter, statusFilter, search, sortKey, sortDir]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => { setSelected(new Set()); }, [typeFilter, statusFilter, search]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(prev =>
      filtered.length > 0 && filtered.every(e => prev.has(e._id!)) ? new Set() : new Set(filtered.map(e => e._id!))
    );
  };
  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e._id!));

  const totalSalary = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary, 0);
  const totalND = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary * e.ndRate / 100, 0);
  const totalNdsht = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary * e.ndshtRate / 100, 0);
  const totalCost = totalSalary + totalND + totalNdsht;
  const engineerCount = employees.filter(e => e.type === "engineer").length;
  const staffCount = employees.filter(e => e.type === "staff").length;

  useEffect(() => {
    const lines = [
      `Нийт ажилтан: ${employees.length} (${engineerCount} инженер, ${staffCount} ажилтан)`,
      `Нийт цалин (идэвхтэй): ${fmt(totalSalary)} | НД: ${fmt(totalND)} | НДШТ: ${fmt(totalNdsht)}`,
      `Нийт зардал (цалин+НД): ${fmt(totalCost)}`,
    ];
    setAiPageContext({ title: t.employees.pageTitle, lines });
    return () => setAiPageContext(null);
  }, [employees.length, engineerCount, staffCount, totalSalary, totalND, totalNdsht, totalCost, t]);

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
      addRecent("employees", "name", form.name);
      addRecent("employees", "position", form.position);
      if (editing) {
        const updated = await updateEmployee(editing, form);
        setEmployees(prev => prev.map(e => e._id === editing ? updated : e));
      } else {
        const created = await createEmployee(form);
        setEmployees(prev => [created, ...prev]);
      }
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.employees.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e._id !== id));
  };

  // Хүснэгтэн дэх мөр бүрийн төлвийг цонх нээхгүйгээр шууд солих.
  const handleInlineStatusChange = async (emp: Employee, next: Employee["status"]) => {
    setOpenStatusId(null);
    try {
      const updated = await updateEmployee(emp._id!, { ...emp, status: next });
      setEmployees(prev => prev.map(x => x._id === emp._id ? updated : x));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.employees.saveError);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => deleteEmployee(id)));
      setEmployees(prev => prev.filter(e => !selected.has(e._id!)));
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.employees.saveError);
    }
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
    } catch { toast.error(t.dashboard.exportErrorAlert); }
    finally { setExporting(false); }
  };

  const SortableHead = ({ sortKeyName, label, align = "left", className = "" }: { sortKeyName: SortKey; label: string; align?: "left" | "right" | "center"; className?: string }) => (
    <TableHead
      onClick={() => toggleSort(sortKeyName)}
      className={`cursor-pointer select-none whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold hover:text-foreground transition-colors px-1.5 ${
        sortKey === sortKeyName ? "text-foreground" : "text-muted-foreground/80"
      } ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""} ${className}`}>
      <span className={`inline-flex items-center gap-0.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${sortKey === sortKeyName ? "opacity-100" : "opacity-0"} ${sortKey === sortKeyName && sortDir === "desc" ? "rotate-180" : ""}`} />
      </span>
    </TableHead>
  );

  const headerActions = (
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
      <LayoutToggleButton />
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
              <Users className="w-5 h-5" /> {t.employees.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.employees.pageSubtitle}</p>
          </div>
        ) : (
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
        )}
        {headerActions}
      </header>

              <nav className={`border-b border-border/50 px-4 sm:px-6 overflow-x-auto ${layoutMode === "sidebar" ? "md:hidden" : ""}`}>
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

      <main className={layoutMode === "sidebar" ? "px-4 sm:px-6 py-6 sm:py-8" : "max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        {error && (
          <div className="mb-4 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-positive/60" />
            <p className="text-xs font-medium text-positive">
              {format(t.employees.selectedCount, { count: String(selected.size) })}
            </p>
            <div className="ml-auto flex items-center gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-destructive hover:text-destructive/80">
                    {t.employees.bulkDeleteButton}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {format(t.employees.bulkDeleteConfirmDesc, { count: String(selected.size) })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t.common.delete}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
                {t.employees.deselect}
              </button>
            </div>
          </div>
        )}

        {/* Search + type/status filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.employees.searchPlaceholder}
              className="h-8 w-56 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {(["engineer", "staff"] as const).map(ty => (
            <button key={ty} onClick={() => setTypeFilter(f => f === ty ? "" : ty)}
              className={`h-8 px-3 text-xs rounded-lg border ${typeFilter === ty
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {ty === "engineer" ? t.employees.typeEngineer : t.employees.typeStaff}
            </button>
          ))}
          <span className="w-px h-5 bg-border" />
          {(["active", "leave", "inactive"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(f => f === s ? "" : s)}
              className={`h-8 px-3 text-xs rounded-lg border ${statusFilter === s
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {statusLabel[s].label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">{t.employees.noEmployees}</p>
            <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">
              {t.employees.addFirstEmployee}
            </Button>
          </div>
        ) : (
          <>
          <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 bg-secondary/40 hover:bg-secondary/40">
                  <TableHead className="w-8 px-1.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-positive" />
                  </TableHead>
                  <SortableHead sortKeyName="name" label={t.employees.colName} />
                  <SortableHead sortKeyName="position" label={t.employees.colPosition} />
                  <SortableHead sortKeyName="type" label={t.employees.colType} />
                  <SortableHead sortKeyName="baseSalary" label={t.employees.colBaseSalary} align="right" />
                  <SortableHead sortKeyName="nd" label={t.employees.colNd} align="right" />
                  <SortableHead sortKeyName="ndsht" label={t.employees.colNdsht} align="right" />
                  <SortableHead sortKeyName="totalCost" label={t.employees.colTotalCost} align="right" />
                  <SortableHead sortKeyName="status" label={t.employees.colStatus} />
                  <TableHead className="text-right px-1.5 whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.employees.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFiltered.map(emp => {
                  const nd = emp.baseSalary * emp.ndRate / 100;
                  const ndsht = emp.baseSalary * emp.ndshtRate / 100;
                  const total = emp.baseSalary + nd + ndsht;
                  const st = statusLabel[emp.status];
                  return (
                    <TableRow key={emp._id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell className="px-1.5">
                        <input type="checkbox" checked={selected.has(emp._id!)} onChange={() => toggleOne(emp._id!)} className="w-4 h-4 cursor-pointer accent-positive" />
                      </TableCell>
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
                        <div className="relative inline-block">
                          <button type="button"
                            onClick={() => setOpenStatusId(openStatusId === emp._id ? null : emp._id!)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                            {st.label}
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </button>
                          {openStatusId === emp._id && (
                            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 min-w-32">
                              {(["active", "leave", "inactive"] as const).map(s => (
                                <button key={s} type="button" onClick={() => handleInlineStatusChange(emp, s)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left">
                                  <Badge className={statusLabel[s].cls}>{statusLabel[s].label}</Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                {t.common.prevPage}
              </Button>
              <span className="text-xs text-muted-foreground stat-number">
                {format(t.common.pageIndicator, { page: String(page), pageCount: String(pageCount) })}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
                {t.common.nextPage}
              </Button>
            </div>
          )}
          </>
        )}
      </main>
      </div>
    </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.employees.editEmployee : t.employees.addEmployee}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.name}</label>
                <Combobox
                  value={form.name}
                  onChange={(v) => setForm(f => ({ ...f, name: v }))}
                  options={getRecent("employees", "name")}
                  placeholder={t.employees.namePlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.employees.position}</label>
                <Combobox
                  value={form.position}
                  onChange={(v) => setForm(f => ({ ...f, position: v }))}
                  options={getRecent("employees", "position")}
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
