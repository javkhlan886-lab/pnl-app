import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getAssets, createAsset, updateAsset, disposeAsset, calcDepreciation } from "@/lib/asset";
import { getEmployees } from "@/lib/employee";
import { toDateInputValue } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
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
import { LogOut, TableIcon, Plus, Pencil, Trash2, ChevronLeft, Box, BarChart2, Users, Receipt, ArrowLeftRight, Download, ShieldCheck, HardHat, Handshake } from "lucide-react";
import { mergeCategories, addCustomCategory } from "@/lib/customCategories";

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

const statusCls: Record<string, string> = {
  active: "bg-positive/15 text-positive hover:bg-positive/15",
  disposed: "bg-muted text-muted-foreground hover:bg-muted",
  maintenance: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15",
};

export default function AssetPage() {
  const navigate = useNavigate();
  const { company, isAdmin } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();

  const statusLabel: Record<string, string> = {
    active: t.assets.statusActive, disposed: t.assets.statusDisposed, maintenance: t.assets.statusMaintenance,
  };

  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [unitPriceDisplay, setUnitPriceDisplay] = useState("");
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [residualDisplay, setResidualDisplay] = useState("");

  const NAV_ITEMS = [
    { path: "/dashboard", label: t.common.navDashboard, icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: t.common.navEmployees, icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: t.common.navAssets, icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: t.common.navExpenses, icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: t.common.navReceivables, icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/workforce", label: t.common.navWorkforce, icon: <HardHat className="w-4 h-4" /> },
    { path: "/partners", label: t.common.navPartners, icon: <Handshake className="w-4 h-4" /> },
    { path: "/transactions", label: t.common.navTransactions, icon: <TableIcon className="w-4 h-4" /> },
    ...(isAdmin ? [{ path: "/admin/users", label: t.common.navAdmin, icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([getAssets(), getEmployees()]);
      setAssets(a); setEmployees(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const assetCategories = mergeCategories(CATEGORIES, "assets");
  const filtered = catFilter ? assets.filter(a => a.category === catFilter) : assets;
  const activeAssets = assets.filter(a => a.status === "active");
  const totalValue = activeAssets.reduce((s, a) => s + a.price, 0);
  const totalAccumDep = activeAssets.reduce((s, a) => {
    if (!a.purchaseDate) return s;
    return s + calcDepreciation(a.price, a.residualValue, a.lifespan, a.depMethod, a.purchaseDate).accumulated;
  }, 0);
  const totalCurrentValue = totalValue - totalAccumDep;

  const openCreate = () => {
    setForm({ ...EMPTY }); setEditing(null);
    setUnitPriceDisplay(""); setQuantityInput(1); setResidualDisplay(""); setOpen(true);
  };
  const openEdit = (a: any) => {
    setForm({ ...a, purchaseDate: toDateInputValue(a.purchaseDate) }); setEditing(a._id);
    setUnitPriceDisplay(a.unitPrice ? Number(a.unitPrice).toLocaleString("mn-MN") : "");
    setQuantityInput(a.quantity || 1);
    setResidualDisplay(a.residualValue === 0 ? "" : a.residualValue.toLocaleString("mn-MN"));
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
      alert(err.response?.data?.error || t.assets.saveError);
    } finally { setSaving(false); }
  };

  const handleDispose = async (id: string) => {
    try {
      await disposeAsset(id);
      setAssets(prev => prev.map(a => a._id === id ? { ...a, status: "disposed" } : a));
    } catch (err: any) {
      alert(err.response?.data?.error || t.assets.saveError);
    }
  };

  const dep = form.price > 0 && form.purchaseDate
    ? calcDepreciation(form.price, form.residualValue, form.lifespan, form.depMethod, form.purchaseDate)
    : null;

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
    } catch { alert(t.dashboard.exportErrorAlert); }
    finally { setExporting(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
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
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Module navigation */}
      <nav className="border-b border-border/50 px-4 sm:px-6 overflow-x-auto">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.assets.statAccumDep}</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{fmt(totalAccumDep)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.assets.total}</p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.assets.statBookValue}</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{fmt(totalCurrentValue)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.assets.asOfToday}</p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {["", ...assetCategories].map(c => (
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
          <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>{t.assets.colName}</TableHead>
                  <TableHead>{t.assets.colCategory}</TableHead>
                  <TableHead className="text-right">{t.assets.colUnitPrice}</TableHead>
                  <TableHead className="text-right">{t.assets.colQuantity}</TableHead>
                  <TableHead className="text-right">{t.assets.colTotalPrice}</TableHead>
                  <TableHead className="text-right">{t.assets.colMonthlyDep}</TableHead>
                  <TableHead className="text-right">{t.assets.colBookValue}</TableHead>
                  <TableHead>{t.assets.colDepPct}</TableHead>
                  <TableHead>{t.assets.colAssignee}</TableHead>
                  <TableHead>{t.assets.colStatus}</TableHead>
                  <TableHead className="text-right">{t.assets.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const d = a.purchaseDate
                    ? calcDepreciation(a.price, a.residualValue, a.lifespan, a.depMethod, a.purchaseDate)
                    : null;
                  return (
                    <TableRow key={a._id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.code}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.category}</TableCell>
                      <TableCell className="text-right stat-number">{fmt(a.unitPrice || 0)}</TableCell>
                      <TableCell className="text-right stat-number">{a.quantity || 1}</TableCell>
                      <TableCell className="text-right stat-number">{fmt(a.price)}</TableCell>
                      <TableCell className="text-right text-negative stat-number">{d ? fmt(d.monthly) : "—"}</TableCell>
                      <TableCell className="text-right text-positive font-medium stat-number">{d ? fmt(d.currentValue) : "—"}</TableCell>
                      <TableCell>
                        {d ? (
                          <div className="flex items-center gap-2 min-w-20">
                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-info rounded-full" style={{ width: `${d.depreciatedPct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{d.depreciatedPct}%</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.assignedTo || "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusCls[a.status]}>{statusLabel[a.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
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
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.assets.editAsset : t.assets.addAsset}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.name}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t.assets.namePlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.category}</label>
                <input list="asset-category-options"
                  className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder={t.transactions.categoryAddNewPlaceholder} />
                <datalist id="asset-category-options">
                  {assetCategories.map(c => <option key={c} value={c} />)}
                </datalist>
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
                <label className="text-xs font-medium text-muted-foreground">{t.assets.residualValue}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={residualDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setResidualDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, residualValue: num }));
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.lifespan}</label>
                <input type="number" min={1} max={50}
                  className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.lifespan} onChange={e => setForm(f => ({ ...f, lifespan: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.assets.depMethod}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.depMethod} onChange={e => setForm(f => ({ ...f, depMethod: e.target.value as any }))}>
                  <option value="straight">{t.assets.methodStraight}</option>
                  <option value="declining">{t.assets.methodDeclining}</option>
                </select>
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
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder={t.assets.locationPlaceholder} />
              </div>
            </div>
            {dep && (
              <div className="bg-secondary/50 rounded-lg px-4 py-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t.assets.depCalcTitle}</p>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t.assets.monthlyDep}</span>
                  <span className="text-negative blur-number">{fmt(dep.monthly)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t.assets.yearlyDep}</span>
                  <span className="text-negative blur-number">{fmt(dep.yearly)}</span>
                </div>
                <div className="flex justify-between py-1 font-medium">
                  <span>{t.assets.currentBookValue}</span>
                  <span className="text-positive blur-number">{fmt(dep.currentValue)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-info rounded-full" style={{ width: `${dep.depreciatedPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{format(t.assets.depreciatedPct, { pct: String(dep.depreciatedPct) })}</span>
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
