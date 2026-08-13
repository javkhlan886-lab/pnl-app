import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useNavigate, useLocation } from "react-router-dom";
import { getPNLList, deletePNL, updatePNL } from "@/lib/pnl";
import { getTransactions } from "@/lib/transaction";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { PNLRecord } from "@/types";
import { fmt, fmtDate } from "@/lib/utils";
import { toMnt } from "@/lib/exchangeRates";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale, format } from "@/hooks/useLocale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, LogOut, Pencil, Trash2, Download, TrendingUp, TrendingDown, BarChart2, CheckCircle, Users, Box, Receipt, ArrowLeftRight, TableIcon, ChevronDown, ShieldCheck, HardHat, Handshake, Eye, EyeOff } from "lucide-react";

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

const ownerName = (r: PNLRecord, unknownLabel: string) =>
  r.owner?.name?.trim() || r.owner?.email?.split("@")[0] || unknownLabel;

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
  const { t, locale } = useLocale();
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [txSummary, setTxSummary] = useState<{ totalIncome: number; totalExpense: number } | null>(null);
  const [txBlurred, setTxBlurred] = useState(false);

  // Хэрэглэгчээр шүүх — эхлээд owner, дараа нь статус, эцэст нь огнооны
  // хязгаараар шүүнэ.
  const ownerScoped = ownerFilter
    ? records.filter((r) => ownerKey(r) === ownerFilter)
    : records;

  const statusScoped = statusFilter
    ? ownerScoped.filter((r) => (r.status || "active") === statusFilter)
    : ownerScoped;

  const filteredRecords = statusScoped.filter((r) => {
    if (!dateFrom && !dateTo) return true;
    if (!r.date) return false;
    // r.date талбар бүтэн ISO timestamp ("2026-08-09T00:00:00.000Z") байж
    // болдог тул эхний 10 тэмдэгтээр нь (YYYY-MM-DD) харьцуулна — эс тэгвэл
    // dateTo-той яг тэнцүү өдрийн бичлэгүүд алдаатайгаар хасагдаж байсан.
    const day = r.date.slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });

  // Dropdown-д харагдах хэрэглэгчдийн жагсаалт — бичлэгийн тооны дарааллаар.
  const ownerOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; email: string; count: number }>();
    records.forEach((r) => {
      const key = ownerKey(r);
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { key, label: ownerName(r, t.dashboard.unknownOwner), email: r.owner?.email || "", count: 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [records, t]);

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

      const response = await api.get(`/pnl/export?ids=${ids.join(",")}&locale=${locale}`, {
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
      alert(t.dashboard.exportErrorAlert);
    } finally {
      setExporting(false);
    }
  };

  // Толгойн статистик карт болон гүйлгээний дэвтэрийн дүн бусад модулиудтай
  // (ажилчид, зардал, авлага гэх мэт) хамт нэгтгэж тооцдог тул зөвхөн
  // records state-ээс дахин тооцох боломжгүй — status солих/устгах бүрд
  // серверээс дахин татаж шинэчилнэ (эс тэгвэл гар refresh хийх хүртэл
  // хуучин дүн харагдсаар байдаг байсан).
  const loadSummary = useCallback(() => {
    api.get("/summary")
      .then((r) => {
        setSummary(r.data);
        setSummaryError(null);
      })
      .catch(() => {
        setSummary(null);
        setSummaryError(t.dashboard.summaryError);
      });

    getTransactions({ limit: 1 })
      .then((r) => setTxSummary({ totalIncome: r.summary.totalIncome, totalExpense: r.summary.totalExpense }))
      .catch(() => setTxSummary(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getPNLList()
      .then(setRecords)
      .catch(() => setError(t.dashboard.loadError))
      .finally(() => setLoading(false));

    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    await deletePNL(id);
    setRecords((prev) => prev.filter((r) => r._id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    loadSummary();
  };

  const handleStatusChange = async (id: string, status: "active" | "pending" | "closed") => {
    await updatePNL(id, { status });
    setRecords(prev => prev.map(r => r._id === id ? { ...r, status } : r));
    setOpenStatusId(null);
    loadSummary();
  };

  const statusConfig = {
    active: { label: t.common.statusActive, dot: "bg-positive", cls: "bg-positive/15 text-positive" },
    pending: { label: t.common.statusPending, dot: "bg-amber-400", cls: "bg-amber-400/15 text-amber-300" },
    closed: { label: t.common.statusClosed, dot: "bg-muted-foreground", cls: "bg-muted text-muted-foreground" },
  };

  // Тайлан бүрийн мөрийн дүнг тухайн тайлангийн `currency`-аар ₮-рүү
  // хөрвүүлж нэмдэг — өөр валюттай тайлангуудыг шууд арифметикаар нэмбэл
  // ам.доллар г.м. дүн төгрөгийн дүн рүү тоо утгаараа алдаатай нэмэгддэг.
  const totalIncome = (r: PNLRecord) =>
    r.incomeRows.reduce((s, x) => s + toMnt(Number(x.amount), r.currency, r.exchangeRate), 0);
  const totalExpenseOf = (r: PNLRecord) =>
    r.expenseRows.reduce((s, x) => s + toMnt(Number(x.amount), r.currency, r.exchangeRate), 0);
  const netProfit = (r: PNLRecord) => totalIncome(r) - totalExpenseOf(r);

  const computedSummary = useMemo(() => {
    if (records.length === 0) return null;
    // Үндсэн дүн зөвхөн идэвхтэй тайлангаас — backend-ийн /summary-тэй ижил
    // логик (хүлээгдэж буй, дуусан төслүүд тус бүрдээ доор задарна).
    const active = records.filter((r) => (r.status || "active") === "active");
    const pnlIncome = active.reduce((sum, record) => sum + totalIncome(record), 0);
    const totalOperatingExpense = active.reduce((sum, record) => sum + totalExpenseOf(record), 0);
    const net = pnlIncome - totalOperatingExpense;
    const margin = pnlIncome > 0 ? Number(((net / pnlIncome) * 100).toFixed(1)) : 0;
    const completed = records.filter((r) => r.status === "closed");
    const completedIncome = completed.reduce((sum, record) => sum + totalIncome(record), 0);
    const completedExpense = completed.reduce((sum, record) => sum + totalExpenseOf(record), 0);
    const pending = records.filter((r) => r.status === "pending");
    const pendingIncome = pending.reduce((sum, record) => sum + totalIncome(record), 0);
    const pendingExpense = pending.reduce((sum, record) => sum + totalExpenseOf(record), 0);
    return {
      pnlIncome,
      pnlCount: active.length,
      totalOperatingExpense,
      netProfit: net,
      margin,
      completedIncome,
      completedExpense,
      completedProfit: completedIncome - completedExpense,
      completedCount: completed.length,
      pendingIncome,
      pendingExpense,
      pendingProfit: pendingIncome - pendingExpense,
      pendingCount: pending.length,
    };
  }, [records]);

  const displaySummary = summary || computedSummary;

  // Толгойн статистик карт (`summary`) нь бүх датаг тооцдог тул огнооны
  // шүүлтүүрт хамаарахгүй — тиймээс шүүсэн `filteredRecords`-с тусад нь
  // өөрийн дүнг тооцоод харуулна.
  const isDateFiltered = Boolean(dateFrom || dateTo);
  const filteredSummary = useMemo(() => {
    if (!isDateFiltered) return null;
    const income = filteredRecords.reduce((sum, record) => sum + totalIncome(record), 0);
    const expense = filteredRecords.reduce((sum, record) => sum + totalExpenseOf(record), 0);
    return { income, expense, net: income - expense, count: filteredRecords.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRecords, isDateFiltered]);

  // Чагт тэмдэглэсэн (сонгосон) тайлангуудын нэгтгэл — export-д ашигладаг
  // ижил `selected` Set дээр суурилна.
  const selectedSummary = useMemo(() => {
    if (selected.size === 0) return null;
    const selectedRecords = records.filter((r) => selected.has(r._id!));
    const income = selectedRecords.reduce((sum, record) => sum + totalIncome(record), 0);
    const expense = selectedRecords.reduce((sum, record) => sum + totalExpenseOf(record), 0);
    return { income, expense, net: income - expense };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, records]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company?.name} />
          <div>
            <h1 className="text-lg font-medium flex items-center gap-2">
              {t.common.productName}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-positive/15 text-positive">
                <span className="live-dot" /> LIVE
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">{company?.name ?? ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting
              ? t.common.exportingLabel
              : selected.size > 0
                ? format(t.common.exportSelected, { count: String(selected.size) })
                : t.common.exportAll}
          </Button>
          <Button onClick={() => navigate("/dashboard/new")} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <PlusCircle className="w-4 h-4 mr-1.5" />
            {t.common.newReport}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1.5" />
            {t.common.logout}
          </Button>
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
        {user && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              {(() => {
                const [before, after] = t.dashboard.greeting.split("{name}");
                return (
                  <>
                    {before}
                    <span className="text-positive">{user.name}</span>
                    {after}
                  </>
                );
              })()} 👋
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
                  <p className="text-sm text-muted-foreground">{t.dashboard.statIncome}</p>
                  <span className="icon-badge-positive w-9 h-9"><BarChart2 className="w-4 h-4" /></span>
                </div>
                <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.pnlIncome, "₮")}</p>
                <p className="relative text-xs text-muted-foreground mt-1">
                  {format(t.dashboard.statIncomeCount, { count: String(displaySummary.pnlCount) })}
                </p>
              </div>
              <div className="glass-card glass-card-negative px-5 py-4">
                <div className="relative flex items-start justify-between">
                  <p className="text-sm text-muted-foreground">{t.dashboard.statOpEx}</p>
                  <span className="icon-badge-negative w-9 h-9"><TrendingDown className="w-4 h-4" /></span>
                </div>
                <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.totalOperatingExpense, "₮")}</p>
                <p className="relative text-xs text-muted-foreground mt-1">{t.dashboard.statOpExSub}</p>
              </div>
              <div className={`glass-card ${displaySummary.netProfit >= 0 ? "glass-card-positive" : "glass-card-negative"} px-5 py-4`}>
                <div className="relative flex items-start justify-between">
                  <p className="text-sm text-muted-foreground">{t.dashboard.statNetProfit}</p>
                  <span className={`${displaySummary.netProfit >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-9 h-9`}><TrendingUp className="w-4 h-4" /></span>
                </div>
                <p className="relative stat-number text-2xl font-bold mt-3 blur-number">{fmt(displaySummary.netProfit, "₮")}</p>
                <p className="relative text-xs text-muted-foreground mt-1">
                  {format(t.dashboard.statMargin, { margin: String(displaySummary.margin) })}
                </p>
              </div>
              {displaySummary.netPosition != null && (
                <div className={`glass-card ${displaySummary.netPosition >= 0 ? "glass-card-positive" : "glass-card-negative"} px-5 py-4`}>
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statNetPosition}</p>
                    <span className={`${displaySummary.netPosition >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-9 h-9`}><CheckCircle className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.netPosition, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">{t.dashboard.statNetPositionSub}</p>
                </div>
              )}
            </div>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statProjectExpense}</p>
                    <span className="icon-badge-negative w-9 h-9"><TrendingDown className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.pnlExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">{t.dashboard.statProjectExpenseSub}</p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statSalary}</p>
                    <span className="icon-badge-negative w-9 h-9"><Users className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.salaryExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">
                    {format(t.dashboard.statSalarySub, { count: String(summary.employeeCount) })}
                  </p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statOffice}</p>
                    <span className="icon-badge-negative w-9 h-9"><Receipt className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.officeExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">{t.dashboard.approvedLabel}</p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statOther}</p>
                    <span className="icon-badge-negative w-9 h-9"><Box className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(summary.otherExpense, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">{t.dashboard.approvedLabel}</p>
                </div>
              </div>
            )}
            {displaySummary.completedCount > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="glass-card glass-card-positive px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statCompletedIncome}</p>
                    <span className="icon-badge-positive w-9 h-9"><CheckCircle className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.completedIncome, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">
                    {format(t.dashboard.statCompletedSub, { count: String(displaySummary.completedCount) })}
                  </p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statCompletedExpense}</p>
                    <span className="icon-badge-negative w-9 h-9"><TrendingDown className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.completedExpense, "₮")}</p>
                </div>
                <div className={`glass-card ${displaySummary.completedProfit >= 0 ? "glass-card-positive" : "glass-card-negative"} px-5 py-4`}>
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statCompletedProfit}</p>
                    <span className={`${displaySummary.completedProfit >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-9 h-9`}><TrendingUp className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.completedProfit, "₮")}</p>
                </div>
              </div>
            )}
            {displaySummary.pendingCount > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="glass-card px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statPendingIncome}</p>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-400/15 text-amber-400"><CheckCircle className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.pendingIncome, "₮")}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">
                    {format(t.dashboard.statPendingSub, { count: String(displaySummary.pendingCount) })}
                  </p>
                </div>
                <div className="glass-card px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statPendingExpense}</p>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-400/15 text-amber-400"><TrendingDown className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.pendingExpense, "₮")}</p>
                </div>
                <div className="glass-card px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.dashboard.statPendingProfit}</p>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-400/15 text-amber-400"><TrendingUp className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(displaySummary.pendingProfit, "₮")}</p>
                </div>
              </div>
            )}
            {txSummary && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-medium text-muted-foreground">{t.transactions.pageTitle}</h2>
                  <button
                    onClick={() => setTxBlurred(v => !v)}
                    title={txBlurred ? t.dashboard.unblurSection : t.dashboard.blurSection}
                    className="text-muted-foreground hover:text-foreground">
                    {txBlurred ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${txBlurred ? "section-blurred" : ""}`}>
                <div className="glass-card glass-card-positive px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.transactions.statIncome}</p>
                    <span className="icon-badge-positive w-9 h-9"><TrendingUp className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(txSummary.totalIncome, "₮")}</p>
                </div>
                <div className="glass-card glass-card-negative px-5 py-4">
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.transactions.statExpense}</p>
                    <span className="icon-badge-negative w-9 h-9"><TrendingDown className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(txSummary.totalExpense, "₮")}</p>
                </div>
                <div className={`glass-card ${txSummary.totalIncome - txSummary.totalExpense >= 0 ? "glass-card-positive" : "glass-card-negative"} px-5 py-4`}>
                  <div className="relative flex items-start justify-between">
                    <p className="text-sm text-muted-foreground">{t.transactions.statNet}</p>
                    <span className={`${txSummary.totalIncome - txSummary.totalExpense >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-9 h-9`}><CheckCircle className="w-4 h-4" /></span>
                  </div>
                  <p className="relative stat-number text-2xl font-bold mt-3">{fmt(txSummary.totalIncome - txSummary.totalExpense, "₮")}</p>
                </div>
                </div>
              </div>
            )}
          </>
        )}

        {selectedSummary && (
          <div className="mb-4 bg-positive/10 border border-positive/25 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3 mb-2.5">
              <span className="text-sm text-positive font-medium">
                {format(t.dashboard.selectedCount, { count: String(selected.size) })}
              </span>
              <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                {t.dashboard.deselect}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2.5 border-t border-positive/20">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredIncome}</p>
                <p className="stat-number text-base font-semibold text-positive">{fmt(selectedSummary.income, "₮")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredExpense}</p>
                <p className="stat-number text-base font-semibold text-negative">{fmt(selectedSummary.expense, "₮")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredNet}</p>
                <p className={`stat-number text-base font-semibold ${selectedSummary.net >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmt(selectedSummary.net, "₮")}
                </p>
              </div>
            </div>
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
              {s === "" ? t.common.all : statusConfig[s].label}
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
                {t.dashboard.ownerFilterLabel}: {activeOwner ? activeOwner.label : t.common.all}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {ownerMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setOwnerMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-30 py-1 min-w-56 max-h-72 overflow-y-auto">
                    <button onClick={() => { setOwnerFilter(""); setOwnerMenuOpen(false); }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left ${!ownerFilter ? "text-info font-medium" : ""}`}>
                      {t.common.all}
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

        {/* Огнооны хязгаараар шүүх */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground">{t.transactions.dateRangeLabel}</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg border border-border bg-background" />
          <span className="text-xs text-muted-foreground">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg border border-border bg-background" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="h-8 px-3 text-xs rounded-full border bg-background text-muted-foreground border-border hover:bg-secondary/50">
              {t.transactions.allFilter}
            </button>
          )}
        </div>

        {filteredSummary && (
          <div className="glass-card px-5 py-4 mb-6">
            <p className="text-xs text-muted-foreground mb-3">
              {format(t.dashboard.filteredSummaryTitle, { count: String(filteredSummary.count) })}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredIncome}</p>
                <p className="stat-number text-lg font-semibold text-positive">{fmt(filteredSummary.income, "₮")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredExpense}</p>
                <p className="stat-number text-lg font-semibold text-negative">{fmt(filteredSummary.expense, "₮")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredNet}</p>
                <p className={`stat-number text-lg font-semibold ${filteredSummary.net >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmt(filteredSummary.net, "₮")}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">{t.dashboard.noRecords}</p>
            <Button onClick={() => navigate("/dashboard/new")}
              className="bg-positive text-background hover:bg-positive/90">
              {t.dashboard.createFirstReport}
            </Button>
          </div>
        ) : (
          <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-positive" />
                  </TableHead>
                  <TableHead>{t.dashboard.colOrgName}</TableHead>
                  {canSeeOwner && <TableHead>{t.dashboard.colOwner}</TableHead>}
                  <TableHead>{t.dashboard.colContractNumber}</TableHead>
                  <TableHead>{t.dashboard.colStatus}</TableHead>
                  <TableHead className="text-right">{t.dashboard.colTotalIncome}</TableHead>
                  <TableHead className="text-right">{t.dashboard.colNetProfit}</TableHead>
                  <TableHead>{t.dashboard.colDate}</TableHead>
                  <TableHead className="text-right">{t.dashboard.colActions}</TableHead>
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
                              <p className="text-sm truncate blur-number">{ownerName(r, t.dashboard.unknownOwner)}</p>
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
                      <TableCell className="text-right text-positive font-medium stat-number">{fmt(income, "₮")}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={profit >= 0
                          ? "bg-positive/15 text-positive hover:bg-positive/15 blur-number"
                          : "bg-negative/15 text-negative hover:bg-negative/15 blur-number"}>
                          {fmt(profit, "₮")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {fmtDate(r.updatedAt)}
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
                                <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                                <AlertDialogDescription>{t.dashboard.deleteReportDesc}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(r._id!)}
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
    </div>
  );
}
