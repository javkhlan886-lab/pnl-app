import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getProducts, createProduct, updateProduct, deleteProduct } from "@/lib/product";
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
import {
  LogOut, TableIcon, Plus, Pencil, Trash2, ChevronLeft, Box, BarChart2, Users, Receipt,
  ArrowLeftRight, Download, ShieldCheck, HardHat, Handshake, Package, Search,
} from "lucide-react";
import { mergeCategories, addCustomCategory } from "@/lib/customCategories";
import { getRecent, addRecent } from "@/lib/recentValues";
import { toDateInputValue } from "@/lib/utils";
import { setAiPageContext } from "@/lib/aiPageContext";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";
import { Combobox } from "@/components/ui/combobox";

// Чөлөөт текст утга — backend-д хадгалагддаг тул хэлээр орчуулахгүй.
const CATEGORIES = ["Бараа", "Материал", "Бэлэн бүтээгдэхүүн", "Түүхий эд", "Бусад"];

const EMPTY = {
  name: "", category: "", description: "", unit: "",
  quantity: 0, price: 0, discountPercent: 0, discountStartDate: "", discountEndDate: "",
  issuedQty: 0, note: "", currency: "₮", status: "active",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

// Хямдруулах хувиар тооцсон зарагдах үнэ — орлого зөвхөн энэ дүнгээр
// тооцогдоно, харин бараа материалын нөөцийн үнэ (Нийт үнийн дүн) хуучин
// нэгж үнээрээ хэвээр үлдэнэ. Хямдрал зөвхөн эхлэх/дуусах хугацааны
// хүрээнд идэвхтэй байна — хугацаанаас гадуур бол жинхэнэ үнээр тооцно.
const sellingPrice = (p: any) => {
  const pct = p.discountPercent || 0;
  if (pct <= 0) return p.price;
  const now = Date.now();
  if (p.discountStartDate && new Date(p.discountStartDate).getTime() > now) return p.price;
  if (p.discountEndDate && new Date(p.discountEndDate).getTime() < now) return p.price;
  return p.price * (1 - pct / 100);
};

const discountedValue = (list: any[]) => list.reduce((s, p) => s + sellingPrice(p) * p.quantity, 0);

const statusCls: Record<string, string> = {
  active: "bg-positive/15 text-positive hover:bg-positive/15",
  inactive: "bg-muted text-muted-foreground hover:bg-muted",
};


export default function ProductPage() {
  const navigate = useNavigate();
  const { company, isAdmin, user } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();
  const layoutMode = useLayoutMode();

  const statusLabel: Record<string, string> = {
    active: t.products.statusActive, inactive: t.products.statusInactive,
  };

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [search, setSearch] = useState("");
  const [quantityDisplay, setQuantityDisplay] = useState("");
  const [priceDisplay, setPriceDisplay] = useState("");
  const [issuedDisplay, setIssuedDisplay] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    try { setProducts(await getProducts()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const productCategories = mergeCategories(CATEGORIES, "products");

  // Шүүлтүүрийн мөрөнд бүх ангилалыг жагсаахын оронд бодит бүтээгдэхүүн дээр
  // хамгийн олон удаа хэрэглэгдсэн 6 ангиллыг автоматаар харуулна.
  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach(p => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    const byUsage = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    if (byUsage.length >= 6) return byUsage.slice(0, 6);
    const fill = CATEGORIES.filter(c => !byUsage.includes(c));
    return [...byUsage, ...fill].slice(0, 6);
  }, [products]);

  const filtered = products.filter(p => {
    if (catFilter && p.category !== catFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q) && !(p.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeProducts = products.filter(p => p.status === "active");
  const finishedProducts = products.filter(p => p.status === "inactive");
  const totalQuantity = activeProducts.reduce((s, p) => s + p.quantity, 0);
  const totalValue = activeProducts.reduce((s, p) => s + p.price * p.quantity, 0);
  const totalIssued = activeProducts.reduce((s, p) => s + p.issuedQty, 0);
  const totalRevenue = activeProducts.reduce((s, p) => s + p.issuedQty * sellingPrice(p), 0);
  const totalRemaining = activeProducts.reduce((s, p) => s + p.remainingQty, 0);
  const finishedQuantity = finishedProducts.reduce((s, p) => s + p.quantity, 0);
  const finishedValue = finishedProducts.reduce((s, p) => s + p.price * p.quantity, 0);
  const finishedIssued = finishedProducts.reduce((s, p) => s + p.issuedQty, 0);
  const finishedRevenue = finishedProducts.reduce((s, p) => s + p.issuedQty * sellingPrice(p), 0);
  const finishedRemaining = finishedProducts.reduce((s, p) => s + p.remainingQty, 0);

  useEffect(() => { setSelected(new Set()); }, [catFilter, search]);

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(prev =>
      filtered.length > 0 && filtered.every(p => prev.has(p._id!)) ? new Set() : new Set(filtered.map(p => p._id!))
    );
  };
  const selectedProducts = filtered.filter(p => selected.has(p._id!));
  const selectedQuantity = selectedProducts.reduce((s, p) => s + p.quantity, 0);
  const selectedTotalValue = selectedProducts.reduce((s, p) => s + p.price * p.quantity, 0);
  const selectedIssued = selectedProducts.reduce((s, p) => s + p.issuedQty, 0);
  const selectedRevenue = selectedProducts.reduce((s, p) => s + p.issuedQty * sellingPrice(p), 0);
  const selectedRemaining = selectedProducts.reduce((s, p) => s + p.remainingQty, 0);
  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p._id!));

  useEffect(() => {
    const lines: string[] = [
      `Идэвхтэй шүүлтүүр: ${catFilter || "бүгд"}${search.trim() ? ` · хайлт: "${search.trim()}"` : ""}`,
      `Харагдаж буй мөр: ${filtered.length} / Нийт: ${products.length}`,
      `Нээлттэй бүтээгдэхүүн: ${activeProducts.length} ш | Нийт тоо: ${Math.round(totalQuantity).toLocaleString("mn-MN")} | Нийт үнэ: ${fmt(totalValue)} | Гарсан: ${Math.round(totalIssued).toLocaleString("mn-MN")} | Орлого: ${fmt(totalRevenue)} | Үлдэгдэл: ${Math.round(totalRemaining).toLocaleString("mn-MN")}`,
    ];
    if (finishedProducts.length > 0) {
      lines.push(
        `Дуусан бүтээгдэхүүн: ${finishedProducts.length} ш | Нийт тоо: ${Math.round(finishedQuantity).toLocaleString("mn-MN")} | Нийт үнэ: ${fmt(finishedValue)} | Гарсан: ${Math.round(finishedIssued).toLocaleString("mn-MN")} | Орлого: ${fmt(finishedRevenue)} | Үлдэгдэл: ${Math.round(finishedRemaining).toLocaleString("mn-MN")}`
      );
    }
    if (selected.size > 0) {
      lines.push(
        `Сонгосон ${selected.size} бүтээгдэхүүн: Нийт тоо ${Math.round(selectedQuantity).toLocaleString("mn-MN")} | Нийт үнэ ${fmt(selectedTotalValue)} | Гарсан ${Math.round(selectedIssued).toLocaleString("mn-MN")} | Орлого: ${fmt(selectedRevenue)} | Үлдэгдэл ${Math.round(selectedRemaining).toLocaleString("mn-MN")}`
      );
    }
    setAiPageContext({ title: t.products.pageTitle, lines });
    return () => setAiPageContext(null);
  }, [
    catFilter, search, filtered.length, products.length, totalQuantity, finishedQuantity, selectedQuantity,
    activeProducts.length, totalValue, totalIssued, totalRevenue, totalRemaining,
    finishedProducts.length, finishedValue, finishedIssued, finishedRevenue, finishedRemaining,
    selected.size, selectedTotalValue, selectedIssued, selectedRevenue, selectedRemaining, t,
  ]);

  const openCreate = () => {
    setForm({ ...EMPTY }); setEditing(null);
    setQuantityDisplay(""); setPriceDisplay(""); setIssuedDisplay(""); setDiscountEnabled(false); setOpen(true);
  };
  const openEdit = (p: any) => {
    setForm({
      ...p,
      discountStartDate: toDateInputValue(p.discountStartDate),
      discountEndDate: toDateInputValue(p.discountEndDate),
    });
    setEditing(p._id);
    setQuantityDisplay(p.quantity ? Number(p.quantity).toLocaleString("mn-MN") : "");
    setPriceDisplay(p.price ? Number(p.price).toLocaleString("mn-MN") : "");
    setIssuedDisplay(p.issuedQty ? Number(p.issuedQty).toLocaleString("mn-MN") : "");
    setDiscountEnabled(!!p.discountPercent && p.discountPercent > 0);
    setOpen(true);
  };

  // Үлдэгдэл 0 болмогц статус автоматаар "Дуусан" болно — гараар "Дуусан"
  // сонгоход үлдэгдэлтэй байвал handleStatusChange үүнийг хориглоно.
  useEffect(() => {
    const remaining = form.quantity - form.issuedQty;
    if (remaining <= 0 && form.status !== "inactive") {
      setForm(f => ({ ...f, status: "inactive" }));
    }
  }, [form.quantity, form.issuedQty]);

  const handleStatusChange = (next: string) => {
    const remaining = form.quantity - form.issuedQty;
    if (next === "inactive" && remaining > 0) {
      alert(format(t.products.cannotFinishWithRemaining, { count: remaining.toLocaleString("mn-MN") }));
      return;
    }
    setForm(f => ({ ...f, status: next }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      addCustomCategory("products", form.category);
      addRecent("products", "name", form.name);
      addRecent("products", "description", form.description);
      addRecent("products", "unit", form.unit);
      addRecent("products", "note", form.note);
      const payload = discountEnabled
        ? form
        : { ...form, discountPercent: 0, discountStartDate: "", discountEndDate: "" };
      if (editing) {
        const updated = await updateProduct(editing, payload);
        setProducts(prev => prev.map(p => p._id === editing ? updated : p));
      } else {
        const created = await createProduct(payload);
        setProducts(prev => [created, ...prev]);
      }
      setOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.error || t.products.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => p._id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || t.products.saveError);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/products/export?locale=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t.products.exportError);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { alert(t.dashboard.exportErrorAlert); }
    finally { setExporting(false); }
  };

  const headerActions = (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
        <Download className="w-4 h-4 mr-1.5" />
        {exporting ? t.common.exportingLabel : t.common.excelExport}
      </Button>
      <Button onClick={openCreate} size="sm"
        className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
        <Plus className="w-4 h-4 mr-1.5" /> {t.products.addProduct}
      </Button>
      <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1.5" /> {t.common.logout}</Button>
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
              <Package className="w-5 h-5" /> {t.products.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.products.pageSubtitle}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium flex items-center gap-2">
                <Package className="w-5 h-5" /> {t.products.pageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">{t.products.pageSubtitle}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.products.statQuantity}</p>
            <p className="relative text-xl font-semibold stat-number">{Math.round(totalQuantity).toLocaleString("mn-MN")}</p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.products.statTotalValue}</p>
            <p className="relative text-xl font-semibold text-info stat-number">{fmt(discountedValue(activeProducts))}</p>
          </div>
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.products.statIssued}</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{Math.round(totalIssued).toLocaleString("mn-MN")}</p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.products.statRevenue}</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{fmt(totalRevenue)}</p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.products.statRemaining}</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{Math.round(totalRemaining).toLocaleString("mn-MN")}</p>
          </div>
        </div>

        {finishedProducts.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              {t.products.finishedSectionTitle}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="glass-card px-4 py-3 opacity-80">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statQuantity}</p>
                <p className="relative text-xl font-semibold text-muted-foreground stat-number">{Math.round(finishedQuantity).toLocaleString("mn-MN")}</p>
              </div>
              <div className="glass-card px-4 py-3 opacity-80">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statTotalValue}</p>
                <p className="relative text-xl font-semibold text-muted-foreground stat-number">{fmt(discountedValue(finishedProducts))}</p>
              </div>
              <div className="glass-card px-4 py-3 opacity-80">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statIssued}</p>
                <p className="relative text-xl font-semibold text-muted-foreground stat-number">{Math.round(finishedIssued).toLocaleString("mn-MN")}</p>
              </div>
              <div className="glass-card px-4 py-3 opacity-80">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statRevenue}</p>
                <p className="relative text-xl font-semibold text-muted-foreground stat-number">{fmt(finishedRevenue)}</p>
              </div>
              <div className="glass-card px-4 py-3 opacity-80">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statRemaining}</p>
                <p className="relative text-xl font-semibold text-muted-foreground stat-number">{Math.round(finishedRemaining).toLocaleString("mn-MN")}</p>
              </div>
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-positive/60" />
              <p className="text-xs font-medium text-positive">
                {format(t.products.selectedCount, { count: String(selected.size) })}
              </p>
              <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                {t.products.deselect}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="glass-card px-4 py-3 ring-1 ring-positive/50">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statQuantity}</p>
                <p className="relative text-xl font-semibold stat-number">{Math.round(selectedQuantity).toLocaleString("mn-MN")}</p>
              </div>
              <div className="glass-card glass-card-positive px-4 py-3 ring-1 ring-positive/50">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statTotalValue}</p>
                <p className="relative text-xl font-semibold text-info stat-number">{fmt(discountedValue(selectedProducts))}</p>
              </div>
              <div className="glass-card glass-card-negative px-4 py-3 ring-1 ring-positive/50">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statIssued}</p>
                <p className="relative text-xl font-semibold text-negative stat-number">{Math.round(selectedIssued).toLocaleString("mn-MN")}</p>
              </div>
              <div className="glass-card glass-card-positive px-4 py-3 ring-1 ring-positive/50">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statRevenue}</p>
                <p className="relative text-xl font-semibold text-positive stat-number">{fmt(selectedRevenue)}</p>
              </div>
              <div className="glass-card glass-card-positive px-4 py-3 ring-1 ring-positive/50">
                <p className="relative text-xs text-muted-foreground mb-1">{t.products.statRemaining}</p>
                <p className="relative text-xl font-semibold text-positive stat-number">{Math.round(selectedRemaining).toLocaleString("mn-MN")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search + category filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.products.searchPlaceholder}
              className="h-8 w-56 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
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
            <p className="text-muted-foreground mb-1">{t.products.noProducts}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" />
                {exporting ? t.common.exportingLabel : t.common.excelExport}
              </Button>
              <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">{t.products.addFirstProduct}</Button>
            </div>
          </div>
        ) : (
          <>
          <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 bg-secondary/40 hover:bg-secondary/40">
                  <TableHead className="w-9">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-positive" />
                  </TableHead>
                  <TableHead className="w-10 whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colIndex}</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colName}</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colCategory}</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colUnit}</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colQuantity}</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colPrice}</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colSellingPrice}</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colIssuedQty}</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colRevenue}</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colRemainingQty}</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colStatus}</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.products.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, idx) => (
                  <TableRow key={p._id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell>
                      <input type="checkbox" checked={selected.has(p._id!)} onChange={() => toggleOne(p._id!)} className="w-4 h-4 cursor-pointer accent-positive" />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.category}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.unit || "—"}</TableCell>
                    <TableCell className="text-right stat-number">{Number(p.quantity).toLocaleString("mn-MN")}</TableCell>
                    <TableCell className="text-right stat-number">{fmt(p.price)}</TableCell>
                    <TableCell className="text-right stat-number">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.discountPercent > 0 && sellingPrice(p) < p.price && (
                          <span className="text-[10px] font-medium text-negative bg-negative/10 rounded px-1 py-0.5">-{p.discountPercent}%</span>
                        )}
                        {fmt(sellingPrice(p))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-negative stat-number">{Number(p.issuedQty).toLocaleString("mn-MN")}</TableCell>
                    <TableCell className="text-right text-positive stat-number">{fmt(p.issuedQty * sellingPrice(p))}</TableCell>
                    <TableCell className="text-right text-positive font-medium stat-number">{Number(p.remainingQty).toLocaleString("mn-MN")}</TableCell>
                    <TableCell>
                      <Badge className={statusCls[p.status]}>{statusLabel[p.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
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
                              <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {format(t.products.deleteConfirmDesc, { name: p.name })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(p._id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {t.common.delete}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </main>
      </div>
    </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.products.editTitle : t.products.newTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.name}</label>
                <Combobox
                  value={form.name}
                  onChange={(v) => setForm(f => ({ ...f, name: v }))}
                  options={getRecent("products", "name")}
                  placeholder={t.products.namePlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.category}</label>
                <Combobox
                  value={form.category}
                  onChange={(v) => setForm(f => ({ ...f, category: v }))}
                  options={productCategories}
                  placeholder={t.transactions.categoryAddNewPlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.unit}</label>
                <Combobox
                  value={form.unit}
                  onChange={(v) => setForm(f => ({ ...f, unit: v }))}
                  options={getRecent("products", "unit")}
                  placeholder={t.products.unitPlaceholder} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.description}</label>
                <Combobox
                  value={form.description}
                  onChange={(v) => setForm(f => ({ ...f, description: v }))}
                  options={getRecent("products", "description")}
                  placeholder={t.products.descriptionPlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.quantity}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={quantityDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setQuantityDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, quantity: num }));
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.unitPrice}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={priceDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setPriceDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, price: num }));
                  }} placeholder="0" />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 cursor-pointer accent-positive"
                    checked={discountEnabled}
                    onChange={e => {
                      const checked = e.target.checked;
                      setDiscountEnabled(checked);
                      if (!checked) setForm(f => ({ ...f, discountPercent: 0, discountStartDate: "", discountEndDate: "" }));
                    }} />
                  {t.products.discountEnabled}
                </label>
                {discountEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t.products.discountPercent}</label>
                      <input type="number" min={0} max={100} step={0.1}
                        className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                        value={form.discountPercent || ""}
                        onChange={e => setForm(f => ({ ...f, discountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                        placeholder="0" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t.products.sellingPrice}</label>
                      <input readOnly
                        className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none text-right text-muted-foreground"
                        value={fmt(sellingPrice(form))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t.products.discountStartDate}</label>
                      <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        value={form.discountStartDate} onChange={e => setForm(f => ({ ...f, discountStartDate: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t.products.discountEndDate}</label>
                      <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        value={form.discountEndDate} onChange={e => setForm(f => ({ ...f, discountEndDate: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.issuedQty}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={issuedDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setIssuedDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, issuedQty: num }));
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.status}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.status} onChange={e => handleStatusChange(e.target.value)}>
                  <option value="active">{t.products.statusActive}</option>
                  <option value="inactive">{t.products.statusInactive}</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.products.note}</label>
                <Combobox
                  value={form.note}
                  onChange={(v) => setForm(f => ({ ...f, note: v }))}
                  options={getRecent("products", "note")} />
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg px-4 py-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t.products.totalPriceLabel}</span>
                <span className="font-medium">{fmt(sellingPrice(form) * form.quantity)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t.products.remainingLabel}</span>
                <span className={`font-medium ${form.quantity - form.issuedQty < 0 ? "text-negative" : "text-positive"}`}>
                  {(form.quantity - form.issuedQty).toLocaleString("mn-MN")}
                </span>
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
