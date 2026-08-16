import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getAssets, createAsset, updateAsset, disposeAsset } from "@/lib/asset";
import { getEmployees } from "@/lib/employee";
import { toDateInputValue } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
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
import { LogOut, TableIcon, Plus, Pencil, Archive, ChevronLeft, ChevronDown, Box, BarChart2, Users, Receipt, ArrowLeftRight, Download, ShieldCheck, HardHat, Handshake, Package, Search } from "lucide-react";
import { mergeCategories, addCustomCategory } from "@/lib/customCategories";
import { getRecent, addRecent } from "@/lib/recentValues";
import { toast } from "@/lib/toast";
import { setAiPageContext } from "@/lib/aiPageContext";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";
import { Combobox } from "@/components/ui/combobox";

// Чөлөөт текст утга — backend-д хадгалагддаг тул хэлээр орчуулахгүй
// (өгөгдлийн бодит утга өөрчлөгдөх эрсдэлтэй).
const CATEGORIES = [
  "Тоног төхөөрөмж", "Тээврийн хэрэгсэл", "Программ хангамж",
  "Тавилга, эд хогшил", "Барилга, байгууламж", "Цахилгаан хэрэгсэл",
  "Нийлмэл хөрөнгө", "Бусад",
];

const EMPTY = {
  name: "", code: "", category: "Тоног төхөөрөмж",
  unitPrice: 0, quantity: 1, price: 0, residualValue: 0, lifespan: 5,
  depMethod: "straight" as "straight" | "declining",
  purchaseDate: new Date().toISOString().split("T")[0],
  supplier: "", assignedTo: "", location: "", note: "", currency: "₮",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

const PAGE_SIZE = 20;

const statusCls: Record<string, string> = {
  active: "bg-positive/15 text-positive hover:bg-positive/15",
  disposed: "bg-muted text-muted-foreground hover:bg-muted",
  maintenance: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15",
};

type SortKey =
  | "index" | "name" | "category" | "unitPrice" | "quantity" | "price"
  | "purchaseDate" | "assignedTo" | "status";

// Баганын толгой дээр дарахад ижил утгатай мөрүүд зэрэгцэн эрэмбэлэгдэж
// харагдана.
const sortValue = (a: any, idx: number, key: SortKey): string | number => {
  switch (key) {
    case "index": return idx;
    case "name": return (a.name || "").toLowerCase();
    case "category": return (a.category || "").toLowerCase();
    case "unitPrice": return a.unitPrice || 0;
    case "quantity": return a.quantity || 1;
    case "price": return a.price || 0;
    case "purchaseDate": return a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
    case "assignedTo": return (a.assignedTo || "").toLowerCase();
    case "status": return a.status;
  }
};

export default function AssetPage() {
  const navigate = useNavigate();
  const { company, isAdmin, user } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();
  const layoutMode = useLayoutMode();

  const statusLabel: Record<string, string> = {
    active: t.assets.statusActive, disposed: t.assets.statusDisposed, maintenance: t.assets.statusMaintenance,
  };

  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "disposed" | "maintenance">("");
  const [search, setSearch] = useState("");
  const [unitPriceDisplay, setUnitPriceDisplay] = useState("");
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [residualValueDisplay, setResidualValueDisplay] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, e] = await Promise.all([getAssets(), getEmployees()]);
      setAssets(a); setEmployees(e);
    } catch {
      setError(t.assets.loadError);
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const assetCategories = mergeCategories(CATEGORIES, "assets");

  // Шүүлтүүрийн мөрөнд бүх ангилалыг жагсаахын оронд бодит хөрөнгө дээр
  // хамгийн олон удаа хэрэглэгдсэн 6 ангиллыг автоматаар харуулна.
  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach(a => counts.set(a.category, (counts.get(a.category) || 0) + 1));
    const byUsage = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    if (byUsage.length >= 6) return byUsage.slice(0, 6);
    const fill = CATEGORIES.filter(c => !byUsage.includes(c));
    return [...byUsage, ...fill].slice(0, 6);
  }, [assets]);

  const filtered = assets.filter(a => {
    if (catFilter && a.category !== catFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.category.toLowerCase().includes(q) && !(a.code || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  let sortedFiltered = filtered;
  if (sortKey) {
    const withIdx = filtered.map((a, i) => ({ a, v: sortValue(a, i, sortKey) }));
    withIdx.sort((x, y) => {
      const cmp = typeof x.v === "string" && typeof y.v === "string"
        ? x.v.localeCompare(y.v)
        : (x.v as number) - (y.v as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    sortedFiltered = withIdx.map(x => x.a);
  }

  const pageCount = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const pagedFiltered = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [catFilter, statusFilter, search, sortKey, sortDir]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const activeAssets = assets.filter(a => a.status === "active");
  const totalValue = activeAssets.reduce((s, a) => s + a.price, 0);

  useEffect(() => { setSelected(new Set()); }, [catFilter, statusFilter, search]);

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(prev =>
      filtered.length > 0 && filtered.every(a => prev.has(a._id!)) ? new Set() : new Set(filtered.map(a => a._id!))
    );
  };
  const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a._id!));

  useEffect(() => {
    const lines = [
      `Идэвхтэй ангиллын шүүлтүүр: ${catFilter || "бүгд"}${search.trim() ? ` · хайлт: "${search.trim()}"` : ""}`,
      `Харагдаж буй мөр: ${filtered.length} / Нийт: ${assets.length}`,
      `Ашиглагдаж буй хөрөнгө: ${activeAssets.length} ш | Нийт үнэ: ${fmt(totalValue)}`,
    ];
    if (selected.size > 0) {
      lines.push(`Сонгосон ${selected.size} хөрөнгө`);
    }
    setAiPageContext({ title: t.assets.pageTitle, lines });
    return () => setAiPageContext(null);
  }, [catFilter, search, filtered.length, assets.length, activeAssets.length, totalValue, selected.size, t]);

  const openCreate = () => {
    setForm({ ...EMPTY }); setEditing(null);
    setUnitPriceDisplay(""); setQuantityInput(1); setResidualValueDisplay(""); setOpen(true);
  };
  const openEdit = (a: any) => {
    setForm({ ...a, purchaseDate: toDateInputValue(a.purchaseDate) }); setEditing(a._id);
    setUnitPriceDisplay(a.unitPrice ? Number(a.unitPrice).toLocaleString("mn-MN") : "");
    setQuantityInput(a.quantity || 1);
    setResidualValueDisplay(a.residualValue ? Number(a.residualValue).toLocaleString("mn-MN") : "");
    setOpen(true);
  };

  const handleSave = async () => {
    const quantity = Math.max(1, Number(form.quantity || 1));
    const unitPrice = Number(form.unitPrice || 0);
    const price = Number(form.price || unitPrice * quantity);
    const payload = { ...form, unitPrice, quantity, price };
    if (!payload.name.trim()) return;
    setSaving(true);
    try {
      addCustomCategory("assets", payload.category);
      addRecent("assets", "name", payload.name);
      addRecent("assets", "location", payload.location);
      addRecent("assets", "supplier", payload.supplier);
      addRecent("assets", "note", payload.note);
      setForm(payload);
      if (editing) {
        const updated = await updateAsset(editing, payload);
        setAssets(prev => prev.map(a => a._id === editing ? updated : a));
      } else {
        const code = "AST-" + payload.category.slice(0, 2).toUpperCase() + "-" + Math.floor(Math.random() * 9000 + 1000);
        const created = await createAsset({ ...payload, code });
        setAssets(prev => [created, ...prev]);
      }
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.assets.saveError);
    } finally { setSaving(false); }
  };

  const handleDispose = async (id: string) => {
    try {
      await disposeAsset(id);
      setAssets(prev => prev.map(a => a._id === id ? { ...a, status: "disposed" } : a));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.assets.saveError);
    }
  };

  const handleBulkDispose = async () => {
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => disposeAsset(id)));
      setAssets(prev => prev.map(a => selected.has(a._id!) ? { ...a, status: "disposed" } : a));
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.assets.saveError);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/assets/export?locale=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t.assets.exportError);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets.xlsx";
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
        <Plus className="w-4 h-4 mr-1.5" /> {t.assets.addAsset}
      </Button>
      <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1.5" /> {t.common.logout}</Button>
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
              <Box className="w-5 h-5" /> {t.assets.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.assets.pageSubtitle}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium flex items-center gap-2">
                <Box className="w-5 h-5" /> {t.assets.pageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">{t.assets.pageSubtitle}</p>
            </div>
          </div>
        )}
        {headerActions}
      </header>

              <nav className={`border-b border-border/50 px-4 sm:px-6 overflow-x-auto ${layoutMode === "sidebar" ? "md:hidden" : ""}`}>
          <div className="max-w-6xl mx-auto flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <button key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 my-2 text-xs rounded-full transition-colors whitespace-nowrap ${
                    active
                      ? "nav-pill-active font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}>
                  {item.icon}{item.label}
                </button>
              );
            })}
          </div>
        </nav>

      <main className={layoutMode === "sidebar" ? "px-4 sm:px-6 py-6 sm:py-8" : "max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
        {error && (
          <div className="mb-4 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.assets.statTotal}</p>
            <p className="relative text-xl font-semibold stat-number">{assets.length}</p>
            <p className="relative text-xs text-muted-foreground mt-1">
              {format(t.assets.statActiveSub, { count: String(activeAssets.length) })}
            </p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.assets.statInitialValue}</p>
            <p className="relative text-xl font-semibold text-info stat-number">{fmt(totalValue)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.assets.total}</p>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-positive/60" />
            <p className="text-xs font-medium text-positive">
              {format(t.assets.selectedCount, { count: String(selected.size) })}
            </p>
            <div className="ml-auto flex items-center gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-destructive hover:text-destructive/80">
                    {t.assets.dispose}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.assets.disposeConfirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {format(t.assets.bulkDisposeConfirmDesc, { count: String(selected.size) })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDispose}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t.assets.dispose}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
                {t.assets.deselect}
              </button>
            </div>
          </div>
        )}

        {/* Search + status/category filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.assets.searchPlaceholder}
              className="h-8 w-56 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {(["active", "disposed", "maintenance"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(f => f === s ? "" : s)}
              className={`h-8 px-3 text-xs rounded-lg border ${statusFilter === s
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {s === "active" ? t.assets.filterActive : s === "disposed" ? t.assets.filterDisposed : t.assets.filterMaintenance}
            </button>
          ))}
          <span className="w-px h-5 bg-border" />
          {["", ...topCategories].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`h-8 px-3 text-xs rounded-lg border ${catFilter === c
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {c || t.common.all}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">{t.assets.noAssets}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" />
                {exporting ? t.common.exportingLabel : t.common.excelExport}
              </Button>
              <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">{t.assets.addFirstAsset}</Button>
            </div>
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
                  <SortableHead sortKeyName="index" label={t.assets.colIndex} className="w-6" />
                  <SortableHead sortKeyName="name" label={t.assets.colName} />
                  <SortableHead sortKeyName="category" label={t.assets.colCategory} />
                  <SortableHead sortKeyName="purchaseDate" label={t.assets.purchaseDate} />
                  <SortableHead sortKeyName="unitPrice" label={t.assets.colUnitPrice} align="right" />
                  <SortableHead sortKeyName="quantity" label={t.assets.colQuantity} align="right" />
                  <SortableHead sortKeyName="price" label={t.assets.colTotalPrice} align="right" />
                  <SortableHead sortKeyName="assignedTo" label={t.assets.colAssignee} />
                  <SortableHead sortKeyName="status" label={t.assets.colStatus} />
                  <TableHead className="text-right px-1.5 whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.assets.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFiltered.map((a, i) => {
                  const idx = (page - 1) * PAGE_SIZE + i;
                  return (
                    <TableRow key={a._id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell className="px-1.5">
                        <input type="checkbox" checked={selected.has(a._id!)} onChange={() => toggleOne(a._id!)} className="w-4 h-4 cursor-pointer accent-positive" />
                      </TableCell>
                      <TableCell className="px-1.5 text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="px-1.5">
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.code}</div>
                      </TableCell>
                      <TableCell className="px-1.5 text-muted-foreground text-sm">{a.category}</TableCell>
                      <TableCell className="px-1.5 text-muted-foreground text-sm">{a.purchaseDate ? toDateInputValue(a.purchaseDate) : "—"}</TableCell>
                      <TableCell className="px-1.5 text-right stat-number">{fmt(a.unitPrice || 0)}</TableCell>
                      <TableCell className="px-1.5 text-right stat-number">{a.quantity || 1}</TableCell>
                      <TableCell className="px-1.5 text-right stat-number">{fmt(a.price)}</TableCell>
                      <TableCell className="px-1.5 text-muted-foreground text-sm">{a.assignedTo || "—"}</TableCell>
                      <TableCell className="px-1.5">
                        <Badge className={statusCls[a.status]}>{statusLabel[a.status]}</Badge>
                      </TableCell>
                      <TableCell className="px-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={t.assets.dispose}>
                                <Archive className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t.assets.disposeConfirmTitle}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {format(t.assets.disposeConfirmDesc, { name: a.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDispose(a._id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {t.assets.dispose}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.assets.editAsset : t.assets.addAsset}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.name}</label>
                <Combobox
                  value={form.name}
                  onChange={(v) => setForm(f => ({ ...f, name: v }))}
                  options={getRecent("assets", "name")}
                  placeholder={t.assets.namePlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.category}</label>
                <Combobox
                  value={form.category}
                  onChange={(v) => setForm(f => ({ ...f, category: v }))}
                  options={assetCategories}
                  placeholder={t.transactions.categoryAddNewPlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.purchaseDate}</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.unitPrice}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={unitPriceDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setUnitPriceDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => {
                      const qty = f.quantity || quantityInput || 1;
                      const total = num * qty;
                      return { ...f, unitPrice: num, price: total, quantity: qty };
                    });
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.quantity}</label>
                <input type="number" min={1} className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  value={quantityInput}
                  onChange={e => {
                    const q = Math.max(1, Number(e.target.value) || 1);
                    setQuantityInput(q);
                    setForm(f => {
                      const unit = f.unitPrice || (Number(unitPriceDisplay.replace(/[^0-9]/g, "")) || 0);
                      const total = unit * q;
                      return { ...f, quantity: q, price: total };
                    });
                  }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.totalPrice}</label>
                <input readOnly className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right text-muted-foreground"
                  value={form.price ? form.price.toLocaleString("mn-MN") : ""} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.assignedEmployee}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                  <option value="">{t.assets.notSelected}</option>
                  {employees.map(e => <option key={e._id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.location}</label>
                <Combobox
                  value={form.location}
                  onChange={(v) => setForm(f => ({ ...f, location: v }))}
                  options={getRecent("assets", "location")}
                  placeholder={t.assets.locationPlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.residualValue}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={residualValueDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setResidualValueDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, residualValue: num }));
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.lifespan}</label>
                <input type="number" min={0} className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  value={form.lifespan || ""}
                  onChange={e => setForm(f => ({ ...f, lifespan: Number(e.target.value) || 0 }))}
                  placeholder="5" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.depMethod}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.depMethod} onChange={e => setForm(f => ({ ...f, depMethod: e.target.value as "straight" | "declining" }))}>
                  <option value="straight">{t.assets.depMethodStraight}</option>
                  <option value="declining">{t.assets.depMethodDeclining}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.supplier}</label>
                <Combobox
                  value={form.supplier}
                  onChange={(v) => setForm(f => ({ ...f, supplier: v }))}
                  options={getRecent("assets", "supplier")}
                  placeholder={t.assets.supplierPlaceholder} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.note}</label>
                <Combobox
                  value={form.note}
                  onChange={(v) => setForm(f => ({ ...f, note: v }))}
                  options={getRecent("assets", "note")} />
              </div>
            </div>
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
