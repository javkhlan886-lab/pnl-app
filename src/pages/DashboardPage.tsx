import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useNavigate, useLocation } from "react-router-dom";
import { getPNLList, deletePNL, updatePNL } from "@/lib/pnl";
import { useAuth } from "@/hooks/useAuth";
import { PNLRecord } from "@/types";
import { fmt, fmtDate } from "@/lib/utils";
import { toMnt } from "@/lib/exchangeRates";
import { setAiPageContext } from "@/lib/aiPageContext";
import { toast } from "@/lib/toast";
import { getHiddenFields, saveHiddenFields, getCollapsedSections, saveCollapsedSections, getReportsTotalOnTop, saveReportsTotalOnTop } from "@/lib/dashboardHidden";
import { useLayoutMode } from "@/lib/layoutMode";
import { LayoutToggleButton } from "@/components/LayoutToggleButton";
import { LogoutButton } from "@/components/LogoutButton";
import { BackToPortalLink } from "@/components/BackToPortalLink";
import { Sidebar } from "@/components/Sidebar";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getExpenses } from "@/lib/expense";
import { getEmployees } from "@/lib/employee";
import { PlusCircle, Pencil, Trash2, Download, TrendingUp, TrendingDown, BarChart2, Users, Box, Receipt, ArrowLeftRight, TableIcon, ChevronDown, ShieldCheck, HardHat, Handshake, EyeOff, Package, Search, ArrowUpDown } from "lucide-react";

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

type SortKey = "orgName" | "contractNumber" | "status" | "income" | "netProfit" | "date";

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isManager, user, company } = useAuth();
  const { t, locale } = useLocale();
  const layoutMode = useLayoutMode();
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
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(() => getHiddenFields());
  const [period, setPeriod] = useState<"" | "7d" | "1m" | "3m">("");
  const [breakdownOpen, setBreakdownOpen] = useState<"income" | "opex" | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const toggleFieldHidden = (id: string) => {
    setHiddenFields(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveHiddenFields(next);
      return next;
    });
  };
  const showAllFields = () => { setHiddenFields(new Set()); saveHiddenFields(new Set()); };

  // Карт бүрийн буланд гарч ирэх жижиг "нуух" товч.
  const HideFieldBtn = ({ id }: { id: string }) => (
    <button
      onClick={() => toggleFieldHidden(id)}
      title={t.dashboard.hideField}
      className="absolute top-1.5 right-1.5 z-10 text-muted-foreground/40 hover:text-destructive transition-colors">
      <EyeOff className="w-3 h-3" />
    </button>
  );

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => getCollapsedSections());
  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveCollapsedSections(next);
      return next;
    });
  };
  // Мөрийн гарчгийн ард гарч ирэх бүхэл бүлгийг нуух/харуулах товч.
  const SectionHideBtn = ({ id }: { id: string }) => (
    <button
      onClick={() => toggleSection(id)}
      title={collapsedSections.has(id) ? t.dashboard.showSection : t.dashboard.hideSection}
      className="text-muted-foreground hover:text-foreground">
      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.has(id) ? "-rotate-90" : ""}`} />
    </button>
  );

  // "Ерөнхий үзүүлэлт" ба "Тайлангуудын нийт дүн" хоёр талбарын дарааллыг
  // сольж, browser-т хадгална.
  const [reportsTotalOnTop, setReportsTotalOnTop] = useState<boolean>(() => getReportsTotalOnTop());
  const toggleSectionOrder = () => {
    setReportsTotalOnTop(prev => {
      const next = !prev;
      saveReportsTotalOnTop(next);
      return next;
    });
  };
  const SwapOrderBtn = () => (
    <button
      onClick={toggleSectionOrder}
      title={t.dashboard.swapSectionsOrder}
      className="text-muted-foreground hover:text-foreground ml-auto">
      <ArrowUpDown className="w-3.5 h-3.5" />
    </button>
  );

  // Хэрэглэгчээр шүүх — эхлээд owner, дараа нь статус, эцэст нь огнооны
  // хязгаараар шүүнэ.
  const ownerScoped = ownerFilter
    ? records.filter((r) => ownerKey(r) === ownerFilter)
    : records;

  const statusScoped = statusFilter
    ? ownerScoped.filter((r) => (r.status || "active") === statusFilter)
    : ownerScoped;

  const dateScoped = statusScoped.filter((r) => {
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

  const filteredRecords = dateScoped.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (r.company || "").toLowerCase().includes(q) || (r.contractNumber || "").toLowerCase().includes(q);
  });

  const sortValue = (r: PNLRecord, key: SortKey): string | number => {
    switch (key) {
      case "orgName": return (r.company || "").toLowerCase();
      case "contractNumber": return (r.contractNumber || "").toLowerCase();
      case "status": return r.status || "active";
      case "income": return totalIncome(r);
      case "netProfit": return netProfit(r);
      case "date": return r.updatedAt || "";
    }
  };

  let sortedRecords = filteredRecords;
  if (sortKey) {
    const withVal = filteredRecords.map((r) => ({ r, v: sortValue(r, sortKey) }));
    withVal.sort((a, b) => {
      const cmp = typeof a.v === "string" && typeof b.v === "string"
        ? a.v.localeCompare(b.v)
        : (a.v as number) - (b.v as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    sortedRecords = withVal.map((x) => x.r);
  }

  const pageCount = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));
  const pagedRecords = sortedRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  useEffect(() => { setPage(1); }, [statusFilter, ownerFilter, dateFrom, dateTo, search, sortKey, sortDir]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const SortableHead = ({ sortKeyName, label, align = "left" }: { sortKeyName: SortKey; label: string; align?: "left" | "right" | "center" }) => (
    <TableHead
      onClick={() => toggleSort(sortKeyName)}
      className={`cursor-pointer select-none whitespace-nowrap ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""} ${sortKey === sortKeyName ? "text-foreground" : ""}`}>
      <span className={`inline-flex items-center gap-0.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${sortKey === sortKeyName ? "opacity-100" : "opacity-0"} ${sortKey === sortKeyName && sortDir === "desc" ? "rotate-180" : ""}`} />
      </span>
    </TableHead>
  );

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
      toast.error(t.dashboard.exportErrorAlert);
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
    api.get("/summary", { params: period ? { period } : {} })
      .then((r) => {
        setSummary(r.data);
        setSummaryError(null);
      })
      .catch(() => {
        setSummary(null);
        setSummaryError(t.dashboard.summaryError);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    getPNLList()
      .then(setRecords)
      .catch(() => setError(t.dashboard.loadError))
      .finally(() => setLoading(false));
    // Зөвхөн "Үйл ажиллагааны зардал" картын задаргаа (Зардал + Ажилчдын
    // цалин) мөр мөрөөр нь харуулахад хэрэгтэй — алдаа гарвал зөвхөн тэр
    // модал хоосон харагдана, самбарын үндсэн дүн (backend-ийн /summary)
    // үүнээс хамаардаггүй тул чимээгүй орхино.
    getExpenses({ status: "approved" }).then(setExpenses).catch(() => {});
    getEmployees().then(setEmployees).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleDelete = async (id: string) => {
    try {
      await deletePNL(id);
      setRecords((prev) => prev.filter((r) => r._id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      loadSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.dashboard.saveError);
    }
  };

  const handleStatusChange = async (id: string, status: "active" | "pending" | "closed") => {
    setOpenStatusId(null);
    try {
      await updatePNL(id, { status });
      setRecords(prev => prev.map(r => r._id === id ? { ...r, status } : r));
      loadSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.dashboard.saveError);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => deletePNL(id)));
      setRecords((prev) => prev.filter((r) => !selected.has(r._id!)));
      setSelected(new Set());
      loadSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.dashboard.saveError);
    }
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
  // "Нийт орлого" картын өөрийнх нь дүнтэй (backend-ийн /summary, зөвхөн
  // Гүйлгээний дэвтэрт баталгаажсан мөрүүд) яг тохирохын тулд зөвхөн
  // received=true мөрүүдийг нэгтгэнэ — доорх тайлангийн хүснэгтэд ашигладаг
  // totalIncome-ээс ЗОРИУДАА тусад нь: тэр хэсгийг хэвээр нь үлдээнэ.
  const receivedIncomeOf = (r: PNLRecord) =>
    r.incomeRows.filter((x) => x.received).reduce((s, x) => s + toMnt(Number(x.amount), r.currency, r.exchangeRate), 0);
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

  // Backend-ийн /summary-д ашигладагтай ижил дундаж хоног/сар — сонгосон
  // үеийн эхлэх огноог тооцож, "Нийт орлого" картын задаргаанд орох идэвхтэй
  // тайлангуудыг мөн ижил цонхоор шүүхэд ашиглана.
  const AVG_DAYS_PER_MONTH = 30.4368;
  const PERIOD_DAYS: Record<string, number> = { "7d": 7, "1m": AVG_DAYS_PER_MONTH, "3m": AVG_DAYS_PER_MONTH * 3 };
  const periodSince = period ? new Date(Date.now() - PERIOD_DAYS[period] * 86400000) : null;

  const incomeBreakdown = useMemo(() => {
    const active = records.filter((r) => (r.status || "active") === "active");
    const inPeriod = periodSince
      ? active.filter((r) => r.date && new Date(r.date) >= periodSince)
      : active;
    const pnlRows = inPeriod
      .map((r) => ({
        id: r._id, date: r.date, name: r.company || "—",
        contractNumber: r.contractNumber || "—", amount: receivedIncomeOf(r),
      }))
      .filter((x) => x.amount !== 0);
    // pnlIncome-д багтдаг ч ямар ч PnL мөрөөс ирдэггүй гэрээгүй орлогын
    // гүйлгээ (жишээ нь шууд барааны борлуулалт) — backend-ийн /summary-аас
    // аль хэдийн тухайн period-оор шүүгдсэн жагсаалт ирдэг тул энд дахин
    // шүүхгүй.
    const standaloneRows = (summary?.standaloneIncome ?? []).map((t: { id: string; date: string; description: string; category: string; amount: number }) => ({
      id: t.id, date: t.date, name: t.description || t.category || "—",
      contractNumber: "—", amount: t.amount,
    }));
    return [...pnlRows, ...standaloneRows].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, period, summary]);

  // "Үйл ажиллагааны зардал" картын мөр мөрөөр задаргаа — backend-ийн
  // /summary-тэй яг ижил тодорхойлолт ашиглана: Зардал = office+other
  // төрлийн Expense; Ажилчдын цалин = идэвхтэй ажилтан бүрийн
  // baseSalary+НД+НДШТ, сонгосон хугацаагаар (сарын харьцаагаар) хувь
  // тэнцүүлсэн — server талын proration-той адилхан.
  const opexBreakdown = useMemo(() => {
    // backend-ийн otherExpense-тэй ижил 4 төрөл (office тусад нь, бусад 3 нь
    // "Бусад/Хувьсах зардал"-д хамрагдана) — өмнө нь зөвхөн office/other
    // шүүгдэж, productCost/marketing нийлбэрт орсон ч задаргаанд
    // харагдахгүй чимээгүй орхигддог байсан.
    const expenseRows = expenses
      .filter((e) => ["office", "other", "productCost", "marketing"].includes(e.type) && (!periodSince || (e.date && new Date(e.date) >= periodSince)))
      .map((e) => ({
        id: e._id, date: e.date, label: e.description || e.category || t.dashboard.breakdownGeneralExpense,
        kind: "expense" as const, amount: Number(e.amount),
      }));

    const salaryProration = periodSince ? PERIOD_DAYS[period] / AVG_DAYS_PER_MONTH : 1;
    const salaryRows = employees
      .filter((e) => e.status === "active")
      .map((e) => {
        const nd = Math.round((Number(e.baseSalary) * Number(e.ndRate)) / 100);
        const ndsht = Math.round((Number(e.baseSalary) * Number(e.ndshtRate)) / 100);
        return {
          id: e._id, date: null as string | null,
          label: [e.name, e.position].filter(Boolean).join(" — ") || t.dashboard.breakdownSalaryExpense,
          kind: "salary" as const,
          amount: Math.round((Number(e.baseSalary) + nd + ndsht) * salaryProration),
        };
      });

    // Гэрээт ажлын тайлангийн Гүйлгээний дэвтэрт баталгаажсан (төлөгдсөн)
    // зардлын мөрүүд — "Үйл ажиллагааны зардал" картад (backend-ийн
    // pnlExpense) мөн адил орсон тул задаргаанд харагдах ёстой.
    const active = records.filter((r) => (r.status || "active") === "active");
    const pnlExpenseRows = active
      .flatMap((r) =>
        r.expenseRows
          .filter((row) => row.received)
          .map((row) => ({
            id: `${r._id}-${row.receivedTransactionId}`,
            date: row.receivedDate,
            label: `${row.name || t.dashboard.breakdownGeneralExpense} (${r.company || "—"})`,
            kind: "pnlExpense" as const,
            amount: toMnt(Number(row.amount), r.currency, r.exchangeRate),
          }))
      )
      .filter((x) => !periodSince || (x.date && new Date(x.date) >= periodSince));

    return [...expenseRows, ...salaryRows, ...pnlExpenseRows]
      .filter((x) => x.amount !== 0)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, employees, records, period]);

  const periodRangeLabel = useMemo(() => {
    if (!period) return t.dashboard.dateRangeAllTime;
    const label = period === "7d" ? t.dashboard.period7d : period === "1m" ? t.dashboard.period1m : t.dashboard.period3m;
    const end = new Date();
    const start = new Date(Date.now() - PERIOD_DAYS[period] * 86400000);
    const fmtDay = (d: Date) => d.toISOString().slice(0, 10);
    return `${label} (${fmtDay(start)} — ${fmtDay(end)})`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

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

  // "Ерөнхий үзүүлэлт" (дээрх 3 карт)-аас ЗОРИУДАА тусад нь: тэр нь зөвхөн
  // Гүйлгээний дэвтэрт баталгаажсан (received=true) дүнг харуулдаг, харин
  // энэ талбар доорх жагсаалтад харагдаж буй БҮХ тайлангийн өөрсдийн бичсэн
  // (баталгаажсан эсэхээс үл хамаарах) incomeRows/expenseRows нийлбэрийг харуулна.
  const reportsTotal = useMemo(() => {
    const income = filteredRecords.reduce((sum, record) => sum + totalIncome(record), 0);
    const expense = filteredRecords.reduce((sum, record) => sum + totalExpenseOf(record), 0);
    return { income, expense, net: income - expense, count: filteredRecords.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRecords]);

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

  useEffect(() => {
    const lines: string[] = [
      `Идэвхтэй шүүлтүүр: статус=${statusFilter || "бүгд"}${dateFrom || dateTo ? ` · хугацаа ${dateFrom || "…"} — ${dateTo || "…"}` : ""}`,
      `Харагдаж буй тайлан: ${filteredRecords.length} / Нийт: ${records.length}`,
    ];
    if (displaySummary) {
      lines.push(
        `Идэвхтэй тайлангийн орлого: ${fmt(displaySummary.pnlIncome, "₮")} | зардал: ${fmt(displaySummary.totalOperatingExpense, "₮")} | цэвэр ашиг: ${fmt(displaySummary.netProfit, "₮")} (маржин ${displaySummary.margin}%)`
      );
      if (displaySummary.pendingCount > 0) {
        lines.push(`Хүлээгдэж буй: ${displaySummary.pendingCount} тайлан | ашиг: ${fmt(displaySummary.pendingProfit, "₮")}`);
      }
      if (displaySummary.completedCount > 0) {
        lines.push(`Дуусан: ${displaySummary.completedCount} тайлан | ашиг: ${fmt(displaySummary.completedProfit, "₮")}`);
      }
    }
    if (filteredSummary) {
      lines.push(`Огнооны шүүлтүүрийн дүн: орлого ${fmt(filteredSummary.income, "₮")} | зардал ${fmt(filteredSummary.expense, "₮")} | цэвэр ${fmt(filteredSummary.net, "₮")}`);
    }
    if (selectedSummary) {
      lines.push(`Сонгосон ${selected.size} тайлан: орлого ${fmt(selectedSummary.income, "₮")} | зардал ${fmt(selectedSummary.expense, "₮")} | цэвэр ${fmt(selectedSummary.net, "₮")}`);
    }
    setAiPageContext({ title: t.common.navDashboard, lines });
    return () => setAiPageContext(null);
  }, [
    statusFilter, dateFrom, dateTo, filteredRecords.length, records.length,
    displaySummary, filteredSummary, selectedSummary, selected.size, t,
  ]);

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

  const headerActions = (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <LayoutToggleButton />
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
      <BackToPortalLink />
      <LogoutButton />
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
            <h1 className="text-lg font-medium">{t.common.productName}</h1>
            <p className="text-xs text-muted-foreground">{company?.name ?? ""}</p>
          </div>
        ) : (
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
        {(() => {
          const mainSection = displaySummary && (
            <>
              {summaryError && (
                <div className="mb-4 flex items-center gap-3 bg-info/10 border border-info/30 rounded-lg px-4 py-3 text-sm text-info">
                  {summaryError}
                </div>
              )}

              {hiddenFields.size > 0 && (
                <div className="mb-4 flex items-center gap-3 bg-secondary/40 border border-border/50 rounded-lg px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">
                    {format(t.dashboard.hiddenFieldsCount, { count: String(hiddenFields.size) })}
                  </span>
                  <button onClick={showAllFields} className="text-xs text-info hover:underline ml-auto">
                    {t.dashboard.showAllFields}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full bg-positive/60" />
                <p className="text-xs font-medium text-muted-foreground">{t.dashboard.mainSectionTitle}</p>
                <SwapOrderBtn />
                <SectionHideBtn id="main" />
                <div className="flex items-center gap-1 ml-auto">
                  {([
                    ["", t.dashboard.dateRangeAllTime],
                    ["7d", t.dashboard.period7d],
                    ["1m", t.dashboard.period1m],
                    ["3m", t.dashboard.period3m],
                  ] as const).map(([value, label]) => (
                    <button key={value} onClick={() => setPeriod(value)}
                      className={`h-6 px-2.5 text-[11px] rounded-full border transition-colors ${period === value
                        ? "bg-positive/15 text-positive border-positive/30"
                        : "bg-card/40 text-muted-foreground border-border/50 hover:bg-secondary/50"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {!collapsedSections.has("main") && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                {!hiddenFields.has("income") && (
                  <div className="glass-card glass-card-positive px-3.5 py-3 cursor-pointer"
                    onClick={() => setBreakdownOpen("income")}>
                    <HideFieldBtn id="income" />
                    <div className="relative flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground truncate">{t.dashboard.statIncome}</p>
                      <span className="icon-badge-positive w-7 h-7 shrink-0"><BarChart2 className="w-3.5 h-3.5" /></span>
                    </div>
                    <p className="relative stat-number text-lg font-bold leading-tight">{fmt(displaySummary.pnlIncome, "₮")}</p>
                    <div className="relative flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        {format(t.dashboard.statIncomeCount, { count: String(displaySummary.pnlCount) })}
                      </p>
                      <ChevronDown className="w-3 h-3 text-muted-foreground -rotate-90" />
                    </div>
                  </div>
                )}
                {!hiddenFields.has("opex") && (
                  <div className="glass-card glass-card-negative px-3.5 py-3 cursor-pointer"
                    onClick={() => setBreakdownOpen("opex")}>
                    <HideFieldBtn id="opex" />
                    <div className="relative flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground truncate">{t.dashboard.statOpEx}</p>
                      <span className="icon-badge-negative w-7 h-7 shrink-0"><TrendingDown className="w-3.5 h-3.5" /></span>
                    </div>
                    <p className="relative stat-number text-lg font-bold leading-tight">{fmt(displaySummary.totalOperatingExpense, "₮")}</p>
                    <div className="relative flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-muted-foreground">{t.dashboard.statOpExSub}</p>
                      <ChevronDown className="w-3 h-3 text-muted-foreground -rotate-90" />
                    </div>
                  </div>
                )}
                {!hiddenFields.has("operatingProfit") && (
                  <div className={`glass-card ${displaySummary.pnlIncome - displaySummary.totalOperatingExpense >= 0 ? "glass-card-positive" : "glass-card-negative"} px-3.5 py-3`}>
                    <HideFieldBtn id="operatingProfit" />
                    <div className="relative flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground truncate">{t.dashboard.statOperatingProfit}</p>
                      <span className={`${displaySummary.pnlIncome - displaySummary.totalOperatingExpense >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-7 h-7 shrink-0`}><TrendingUp className="w-3.5 h-3.5" /></span>
                    </div>
                    <p className="relative stat-number text-lg font-bold leading-tight blur-number">{fmt(displaySummary.pnlIncome - displaySummary.totalOperatingExpense, "₮")}</p>
                    <p className="relative text-[11px] text-muted-foreground mt-0.5">
                      {format(t.dashboard.statMargin, { margin: String(displaySummary.pnlIncome > 0 ? Math.round(((displaySummary.pnlIncome - displaySummary.totalOperatingExpense) / displaySummary.pnlIncome) * 100) : 0) })}
                    </p>
                  </div>
                )}
              </div>
              )}
            </>
          );

          const reportsSection = reportsTotal.count > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="w-1.5 h-1.5 rounded-full bg-info/60" />
                <p className="text-xs font-medium text-muted-foreground">
                  {format(t.dashboard.reportsTotalTitle, { count: String(reportsTotal.count) })}
                </p>
                <SwapOrderBtn />
                <SectionHideBtn id="reportsTotal" />
              </div>
              <p className="text-[11px] text-muted-foreground/70 mb-2">{t.dashboard.reportsTotalSub}</p>
              {!collapsedSections.has("reportsTotal") && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="glass-card glass-card-positive px-3.5 py-3">
                    <div className="relative flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground truncate">{t.dashboard.filteredIncome}</p>
                      <span className="icon-badge-positive w-7 h-7 shrink-0"><BarChart2 className="w-3.5 h-3.5" /></span>
                    </div>
                    <p className="relative stat-number text-lg font-bold leading-tight">{fmt(reportsTotal.income, "₮")}</p>
                  </div>
                  <div className="glass-card glass-card-negative px-3.5 py-3">
                    <div className="relative flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground truncate">{t.dashboard.filteredExpense}</p>
                      <span className="icon-badge-negative w-7 h-7 shrink-0"><TrendingDown className="w-3.5 h-3.5" /></span>
                    </div>
                    <p className="relative stat-number text-lg font-bold leading-tight">{fmt(reportsTotal.expense, "₮")}</p>
                  </div>
                  <div className={`glass-card ${reportsTotal.net >= 0 ? "glass-card-positive" : "glass-card-negative"} px-3.5 py-3`}>
                    <div className="relative flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted-foreground truncate">{t.dashboard.filteredNet}</p>
                      <span className={`${reportsTotal.net >= 0 ? "icon-badge-positive" : "icon-badge-negative"} w-7 h-7 shrink-0`}><TrendingUp className="w-3.5 h-3.5" /></span>
                    </div>
                    <p className="relative stat-number text-lg font-bold leading-tight">{fmt(reportsTotal.net, "₮")}</p>
                  </div>
                </div>
              )}
            </div>
          );

          return reportsTotalOnTop ? <>{reportsSection}{mainSection}</> : <>{mainSection}{reportsSection}</>;
        })()}

        {/* Хайлт */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.dashboard.searchPlaceholder}
              className="h-8 w-56 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredIncome}</p>
                <p className="stat-number text-lg font-semibold text-positive break-words">{fmt(filteredSummary.income, "₮")}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredExpense}</p>
                <p className="stat-number text-lg font-semibold text-negative break-words">{fmt(filteredSummary.expense, "₮")}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredNet}</p>
                <p className={`stat-number text-lg font-semibold break-words ${filteredSummary.net >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmt(filteredSummary.net, "₮")}
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedSummary && (
          <div className="glass-card px-5 py-4 mb-6 ring-1 ring-positive/40">
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs text-positive font-medium">
                {format(t.dashboard.selectedCount, { count: String(selected.size) })}
              </p>
              <div className="ml-auto flex items-center gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-xs text-destructive hover:text-destructive/80">
                      {t.dashboard.bulkDeleteButton}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {format(t.dashboard.bulkDeleteConfirmDesc, { count: String(selected.size) })}
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
                  {t.dashboard.deselect}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredIncome}</p>
                <p className="stat-number text-lg font-semibold text-positive break-words">{fmt(selectedSummary.income, "₮")}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredExpense}</p>
                <p className="stat-number text-lg font-semibold text-negative break-words">{fmt(selectedSummary.expense, "₮")}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{t.dashboard.filteredNet}</p>
                <p className={`stat-number text-lg font-semibold break-words ${selectedSummary.net >= 0 ? "text-positive" : "text-negative"}`}>
                  {fmt(selectedSummary.net, "₮")}
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
                  <SortableHead sortKeyName="orgName" label={t.dashboard.colOrgName} />
                  {canSeeOwner && <TableHead>{t.dashboard.colOwner}</TableHead>}
                  <SortableHead sortKeyName="contractNumber" label={t.dashboard.colContractNumber} />
                  <SortableHead sortKeyName="status" label={t.dashboard.colStatus} />
                  <SortableHead sortKeyName="income" label={t.dashboard.colTotalIncome} align="right" />
                  <SortableHead sortKeyName="netProfit" label={t.dashboard.colNetProfit} align="right" />
                  <SortableHead sortKeyName="date" label={t.dashboard.colDate} />
                  <TableHead className="text-right">{t.dashboard.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRecords.map((r) => {
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
        {!loading && records.length > 0 && pageCount > 1 && (
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
      </main>
      </div>
    </div>

      <Dialog open={breakdownOpen === "income"} onOpenChange={(o) => setBreakdownOpen(o ? "income" : null)}>
        <DialogContent className="max-w-[67.2rem]">
          <DialogHeader className="flex-row items-center gap-3 space-y-0">
            <span className="icon-badge-positive w-9 h-9 shrink-0"><BarChart2 className="w-4 h-4" /></span>
            <div>
              <DialogTitle>{t.dashboard.incomeBreakdownTitle}</DialogTitle>
              <DialogDescription>{t.dashboard.statIncome} · {periodRangeLabel}</DialogDescription>
            </div>
          </DialogHeader>
          <div className="max-h-[72vh] overflow-y-auto overflow-x-auto -mx-6 px-6">
            {incomeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t.dashboard.breakdownEmpty}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead>{t.dashboard.colDate}</TableHead>
                    <TableHead>{t.dashboard.colOrgName}</TableHead>
                    <TableHead className="max-w-[180px]">{t.dashboard.colContractNumber}</TableHead>
                    <TableHead className="text-right">{t.dashboard.filteredIncome}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeBreakdown.map((row, i) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(row.date)}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[180px] break-all">{row.contractNumber}</TableCell>
                      <TableCell className="text-right text-positive font-medium stat-number">{fmt(row.amount, "₮")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={breakdownOpen === "opex"} onOpenChange={(o) => setBreakdownOpen(o ? "opex" : null)}>
        <DialogContent className="max-w-[67.2rem]">
          <DialogHeader className="flex-row items-center gap-3 space-y-0">
            <span className="icon-badge-negative w-9 h-9 shrink-0"><TrendingDown className="w-4 h-4" /></span>
            <div>
              <DialogTitle>{t.dashboard.opexBreakdownTitle}</DialogTitle>
              <DialogDescription>{t.dashboard.statOpExSub} · {periodRangeLabel}</DialogDescription>
            </div>
          </DialogHeader>
          <div className="max-h-[72vh] overflow-y-auto overflow-x-auto -mx-6 px-6">
            {opexBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t.dashboard.breakdownEmpty}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead>{t.dashboard.colDate}</TableHead>
                    <TableHead className="max-w-[220px]">{t.dashboard.colDescription}</TableHead>
                    <TableHead>{t.dashboard.colType}</TableHead>
                    <TableHead className="text-right">{t.dashboard.colAmount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opexBreakdown.map((row, i) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-muted-foreground">{row.date ? fmtDate(row.date) : "—"}</TableCell>
                      <TableCell className="font-medium max-w-[220px] break-words">{row.label}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.kind === "salary" ? t.dashboard.typeSalaryShort
                          : row.kind === "pnlExpense" ? t.dashboard.typePnlExpenseShort
                          : t.dashboard.breakdownGeneralExpense}
                      </TableCell>
                      <TableCell className="text-right text-negative font-medium stat-number">{fmt(row.amount, "₮")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
