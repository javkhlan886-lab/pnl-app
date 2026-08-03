import { useEffect, useMemo, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useNavigate, useLocation } from "react-router-dom";
import { getPNLList, deletePNL, updatePNL } from "@/lib/pnl";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { PNLRecord } from "@/types";
import { fmt } from "@/lib/utils";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, LogOut, Pencil, Trash2, Download, TrendingUp, TrendingDown, BarChart2, CheckCircle, Users, Box, Receipt, ArrowLeftRight, TableIcon, ChevronDown, ShieldCheck } from "lucide-react";

// ── Оруулсан хэрэглэгчийг харуулах туслах функцууд ──────────────────────────
// owner талбарыг backend зөвхөн Level 1, 2 (admin, manager)-д илгээдэг.
const UNKNOWN_OWNER = "unknown";

const OWNER_COLORS = [
  "bg-positive/15 text-positive",
  "bg-info/15 text-info",
  "bg-amber-400/15 text-amber-300",
  "bg-purple-400/15 text-purple-300",
  "bg-pink-400/15 text-pink-300",
  "bg-cyan-400/15 text-cyan-300",
];

const ownerKey = (r: PNLRecord) => r.owner?.id || r.userId || UNKNOWN_OWNER;

const ownerName = (r: PNLRecord) =>
  r.owner?.name?.trim() || r.owner?.email?.split("@")[0] || "Тодорхойгүй";

const ownerInitials = (r: PNLRecord) => {
  const src = r.owner?.name?.trim() || r.owner?.email || "?";
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  const raw = parts.length > 1 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return raw.toUpperCase();
};

// ID-аас хамаарсан тогтмол өнгө — хэрэглэгч бүр ижил өнгөтэй харагдана.
const ownerColor = (r: PNLRecord) => {
  const key = ownerKey(r);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973;
  return OWNER_COLORS[h % OWNER_COLORS.length];
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isManager, user, company } = useAuth();
  // Level 1 (admin) ба Level 2 (manager) бүх хэрэглэгчийн датаг хардаг тул
  // тэдэнд "Оруулсан" багана болон хэрэглэгчээр шүүх сонголтыг үзүүлнэ.
  const canSeeOwner = isAdmin || isManager;
  const [records, setRecords] = useState<PNLRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "pending" | "closed">("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  // Хэрэглэгчээр шүүх — эхлээд owner, дараа нь статусаар шүүнэ.
  // Статусын тоолуур нь сонгосон хэрэглэгчийн бичлэгүүд дээр тооцогдоно.
  const ownerScoped = ownerFilter
    ? records.filter((r) => ownerKey(r) === ownerFilter)
    : records;

  const filteredRecords = statusFilter
    ? ownerScoped.filter((r) => (r.status || "active") === statusFilter)
    : ownerScoped;

  // Dropdown-д харагдах хэрэглэгчдийн жагсаалт — бичлэгийн тооны дарааллаар.
  const ownerOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; email: string; count: number }>();
    records.forEach((r) => {
      const key = ownerKey(r);
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { key, label: ownerName(r), email: r.owner?.email || "", count: 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [records]);

  const activeOwner = ownerOptions.find((o) => o.key === ownerFilter);

  // Сонгох/бүгдийг сонгох нь шүүсэн бичлэгүүд дээр ажиллана — ингэснээр
  // шүүлтүүрээр нуугдсан тайлан санамсаргүй export-д орохгүй.
  const allSelected = filteredRecords.length > 0 && filteredRecords.every((r) => selected.has(r._id!));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRecords.map((r) => r._id!)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const ids = selected.size > 0
        ? Array.from(selected)
        : records.map((r) => r._id!);

      const response = await api.get(`/pnl/export?ids=${ids.join(",")}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "pnl-export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Export алдаа гарлаа");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    getPNLList()
      .then(setRecords)
      .catch(() => setError("Тайлангийн мэдээллийг татаж чадсангүй"))
      .finally(() => setLoading(false));

    api.get("/summary")
      .then((r) => {
        setSummary(r.data);
        setSummaryError(null);
      })
      .catch(() => {
        setSummary(null);
        setSummaryError("Нийт дүнгийн мэдээллийг серверээс татаж чадсан тул тайлангаас тооцсон өгөгдлийг харуулж байна.");
      });
  }, []);

  const handleDelete = async (id: string) => {
    await deletePNL(id);
    setRecords((prev) => prev.filter((r) => r._id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleStatusChange = async (id: string, status: "active" | "pending" | "closed") => {
    await updatePNL(id, { status });
    setRecords(prev => prev.map(r => r._id === id ? { ...r, status } : r));
    setOpenStatusId(null);
  };

  const statusConfig = {
    active: { label: "Идэвхтэй", dot: "bg-positive", cls: "bg-positive/15 text-positive" },
    pending: { label: "Хүлээгдэж буй", dot: "bg-amber-400", cls: "bg-amber-400/15 text-amber-300" },
    closed: { label: "Хаагдсан", dot: "bg-muted-foreground", cls: "bg-muted text-muted-foreground" },
  };

  const totalIncome = (r: PNLRecord) =>
    r.incomeRows.reduce((s, x) => s + Number(x.amount), 0);
  const netProfit = (r: PNLRecord) =>
    r.incomeRows.reduce((s, x) => s + Number(x.amount), 0) -
    r.expenseRows.reduce((s, x) => s + Number(x.amount), 0);

  const computedSummary = useMemo(() => {
    if (records.length === 0) return null;
    const pnlIncome = records.reduce((sum, record) => sum + totalIncome(record), 0);
    const totalOperatingExpense = records.reduce(
      (sum, record) => sum + record.expenseRows.reduce((s, x) => s + Number(x.amount), 0),
      0
    );
    const net = pnlIncome - totalOperatingExpense;
    const margin = pnlIncome > 0 ? Number(((net / pnlIncome) * 100).toFixed(1)) : 0;
    return {
      pnlIncome,
      pnlCount: records.length,
      totalOperatingExpense,
      netProfit: net,
      margin,
    };
  }, [records]);

  const displaySummary = summary || computedSummary;

  const NAV_ITEMS = [
    { path: "/dashboard", label: "P&L Тайлан", icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: "Ажилчид & Цалин", icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: "Хөрөнгө", icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: "Зардал", icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: "Зээл & Авлага", icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/transactions", label: "Гүйлгээний дэвтэр", icon: <TableIcon className="w-4 h-4" /> },
    ...(isAdmin ? [{ path: "/admin/users", label: "Админ", icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company?.name} />
          <div>
            <h1 className="text-lg font-medium flex items-center gap-2">
              P&L Удирдлага
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-positive/15 text-positive">
                <span className="live-dot" /> LIVE
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">{company?.name ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Боловсруулж байна..." : selected.size > 0 ? `Export (${selected.size})` : "Бүгдийн Export"}
          </Button>
          <Button onClick={() => navigate("/dashboard/new")} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Шинэ тайлан
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1.5" />
            Гарах
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Module navigation */}
      <nav className="border-b border-border/50 px-6 overflow-x-auto">
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        {user && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Амжилт Хүсье, <span className="text-positive">{user.name }</span> 👋
            </h2>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {/* Summary cards */}
        {displaySummary && (
          <>
            {summaryError && (
              <div className="mb-4 flex items-center gap-3 bg-info/10 border border-info/30 rounded-lg px-4 py-3 text-sm text-info">
                {summaryError}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="glass-card glass-card-positive px-5 py-4">
                <div className="relative flex items-start justify-between">
                  <p className="text-sm text-muted-foreground">Нийт орлого</p>
                  <span className="icon-badge-positive w-9 h-9"><BarChart2 className="w-4 h-4" /></span>
                </div>
                <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.pnlIncome, "₮")}</p>
                <p className="relative text-xs text-muted-foreground mt-1">{displaySummary.pnlCount} тайлан</p>
              </div>
              <div className="glass-card glass-card-negative px-5 py-4">
                <div className="relative flex items-start justify-between">
                  <p className="text-sm text-muted-foreground">Үйл ажиллагааны зардал</p>
                  <span className="icon-badge-negative w-9 h-9"><TrendingDown className="w-4 h-4" /></span>
                </div>
                <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.totalOperatingExpense, "₮")}</p>
                <p className="relative text-xs text-muted-foreground mt-1">Цалин + НДШ + Бусад</p>
              </div>
              <div className={`glass-card ${displaySummary.netProfit >= 0 ? "glass-card-positive" : "glass-card-negative"} px-5 py-4`}>
                <div className="relative flex items-start justify-between">
                  <p className="text-sm text-muted-foreground">Цэвэр ашиг</p>
                  <span className={`${displaySummary.netProfit >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-9 h-9`}><TrendingUp className="w-4 h-4" /></span>
                </div>
                <p className="relative stat-number text-2xl font-bold mt-3 blur-number">{fmt(displaySummary.netProfit, "₮")}</p>
                <p className="relative text-xs text-muted-foreground mt-1">Маржин: {displaySummary.margin}%</p>
              </div>
              {displaySummary.netPosition != null && (
                <div className={`glass-card ${displaySummary.netPosition >= 0 ? "glass-card-positive" : "glass-card-negative"} px-5 py-4`}>
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">Цэвэр байрлал</p>
                    <span className={`${displaySummary.netPosition >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-9 h-9`}><CheckCircle className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.netPosition, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">Авлага — Зээл</p>
                </div>
              )}
            </div>
            {summary && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">Төслийн зардал</p>
                    <span className="icon-badge-negative w-9 h-9"><TrendingDown className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.pnlExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">P&L тайлангийн</p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">Цалин & НД</p>
                    <span className="icon-badge-negative w-9 h-9"><Users className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.salaryExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">{summary.employeeCount} ажилтан</p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">Оффис зардал</p>
                    <span className="icon-badge-negative w-9 h-9"><Receipt className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.officeExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">Батлагдсан</p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">Бусад зардал</p>
                    <span className="icon-badge-negative w-9 h-9"><Box className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.otherExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">Батлагдсан</p>
                </div>
              </div>
            )}
          </>
        )}

        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3 bg-positive/10 border border-positive/25 rounded-lg px-4 py-2.5">
            <span className="text-sm text-positive font-medium">
              {selected.size} тайлан сонгогдсон
            </span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
              Цуцлах
            </button>
          </div>
        )}

        {/* Status filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(["", "active", "pending", "closed"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`h-8 px-3 text-xs rounded-full border flex items-center gap-1.5 transition-colors ${statusFilter === s
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-card/40 text-muted-foreground border-border/50 hover:bg-secondary/50"}`}>
              {s !== "" && <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].dot}`} />}
              {s === "" ? "Бүгд" : statusConfig[s].label}
              <span className="opacity-60">({s === "" ? ownerScoped.length : ownerScoped.filter(r => (r.status || "active") === s).length})</span>
            </button>
          ))}

          {/* Оруулсан хэрэглэгчээр шүүх — зөвхөн Level 1, 2 */}
          {canSeeOwner && ownerOptions.length > 0 && (
            <div className="relative ml-auto">
              <button onClick={() => setOwnerMenuOpen(o => !o)}
                className={`h-8 px-3 text-xs rounded-full border flex items-center gap-1.5 transition-colors ${ownerFilter
                  ? "bg-info/15 text-info border-info/30"
                  : "bg-card/40 text-muted-foreground border-border/50 hover:bg-secondary/50"}`}>
                <Users className="w-3.5 h-3.5" />
                Оруулсан: {activeOwner ? activeOwner.label : "Бүгд"}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {ownerMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setOwnerMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-30 py-1 min-w-56 max-h-72 overflow-y-auto">
                    <button onClick={() => { setOwnerFilter(""); setOwnerMenuOpen(false); }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left ${!ownerFilter ? "text-info font-medium" : ""}`}>
                      Бүгд
                      <span className="opacity-60">{records.length}</span>
                    </button>
                    <div className="h-px bg-border my-1" />
                    {ownerOptions.map(o => (
                      <button key={o.key} onClick={() => { setOwnerFilter(o.key); setOwnerMenuOpen(false); }}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left ${ownerFilter === o.key ? "text-info font-medium" : ""}`}>
                        <span className="truncate">
                          {o.label}
                          {o.email && <span className="text-muted-foreground ml-1.5">{o.email}</span>}
                        </span>
                        <span className="opacity-60 shrink-0">{o.count}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Уншиж байна...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Тайлан байхгүй байна</p>
            <Button onClick={() => navigate("/dashboard/new")}
              className="bg-positive text-background hover:bg-positive/90">
              Шинэ тайлан үүсгэх
            </Button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-positive" />
                  </TableHead>
                  <TableHead>Байгууллагын нэр</TableHead>
                  {canSeeOwner && <TableHead>Оруулсан</TableHead>}
                  <TableHead>Гэрээний дугаар</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Нийт орлого</TableHead>
                  <TableHead className="text-right">Цэвэр ашиг</TableHead>
                  <TableHead>Огноо</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r) => {
                  const income = totalIncome(r);
                  const profit = netProfit(r);
                  const isSelected = selected.has(r._id!);
                  const st = statusConfig[r.status as keyof typeof statusConfig] || statusConfig.active;
                  return (
                    <TableRow key={r._id} className={`border-border/50 ${isSelected ? "bg-positive/[0.08]" : "hover:bg-secondary/30"}`}>
                      <TableCell>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(r._id!)} className="w-4 h-4 cursor-pointer accent-positive" />
                      </TableCell>
                      <TableCell className="font-medium blur-number">{r.company || "—"}</TableCell>
                      {canSeeOwner && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold ${ownerColor(r)}`}>
                              {ownerInitials(r)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm truncate blur-number">{ownerName(r)}</p>
                              {r.owner?.email && (
                                <p className="text-xs text-muted-foreground truncate">{r.owner.email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        {r.contractNumber
                          ? <Badge variant="outline" className="text-xs text-positive border-positive/30">{r.contractNumber}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenStatusId(openStatusId === r._id ? null : r._id!)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </button>
                          {openStatusId === r._id && (
                            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 min-w-36">
                              {(["active", "pending", "closed"] as const).map(s => (
                                <button key={s} onClick={() => handleStatusChange(r._id!, s)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left">
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].dot}`} />
                                  {statusConfig[s].label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-positive font-medium stat-number">{fmt(income, r.currency)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={profit >= 0
                          ? "bg-positive/15 text-positive hover:bg-positive/15 blur-number"
                          : "bg-negative/15 text-negative hover:bg-negative/15 blur-number"}>
                          {fmt(profit, r.currency)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("mn-MN") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/${r._id}`)}>
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
                                <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
                                <AlertDialogDescription>Энэ тайланг устгавал буцааж сэргээх боломжгүй.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(r._id!)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Устгах
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
    </div>
  );
}
