import { useEffect, useState, useCallback, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getReceivables, createReceivable, updateReceivable, deleteReceivable } from "@/lib/receivable";
import { fmtDate, toDateInputValue } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLocale, format } from "@/hooks/useLocale";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LayoutToggleButton } from "@/components/LayoutToggleButton";
import { LogoutButton } from "@/components/LogoutButton";
import { BackToPortalLink } from "@/components/BackToPortalLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResizableHead } from "@/components/ui/resizable-head";
import { useResizableColumns } from "@/lib/useResizableColumns";
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
import { TableIcon, Plus, Pencil, Trash2, ChevronLeft, ArrowLeftRight, BarChart2, Users, Box, Receipt, Download, ShieldCheck, HardHat, Handshake, Package, Search, ChevronDown } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { getRecent, addRecent } from "@/lib/recentValues";
import { toast } from "@/lib/toast";
import { setAiPageContext } from "@/lib/aiPageContext";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";

const EMPTY = {
  type: "receivable" as "receivable" | "loan",
  counterparty: "", unitPrice: 0, amount: 0, startDate: "", dueDate: "",
  interestRate: 0, status: "current" as "current" | "near" | "overdue" | "paid",
  note: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

// Сарын хүүг эхлэх огноогоос (эсвэл хуучин бичлэгүүдэд эхлэх огноо
// байхгүй бол бүртгэсэн өдрөөс) өнөөдөр хүртэлх бодит хоногоор тооцож,
// харин хугацаа дуусахад хүрсэн бол дуусах огноогоор хязгаарлана.
const daysBetween = (start?: string, endTs: number = Date.now()) => {
  if (!start) return 0;
  const s = new Date(start).getTime();
  if (Number.isNaN(s)) return 0;
  return Math.max(0, (endTs - s) / 86400000);
};

const accrualEndTs = (item: any) => {
  const dueTs = item.dueDate ? new Date(item.dueDate).getTime() : NaN;
  return !Number.isNaN(dueTs) ? Math.min(Date.now(), dueTs) : Date.now();
};

const accruedDays = (item: any) => daysBetween(item.startDate || item.createdAt, accrualEndTs(item));

// Сарын хүүг 30 хоногоор хувааж өдрийн хүү гаргана (Монголд өргөн
// хэрэглэгддэй энгийн арга) — ингэснээр яг 30 хоног өнгөрөхөд
// хуримтлагдсан хүү сарын хүүтэй (жишээ нь 1.5%) яг таарч байх ёстой.
// Өмнө нь сарын дундаж уртаар (30.4368) хуваадаг байсан тул 30 хоногийн
// хугацаанд хүлээгдэж буй дүнгээс бага зэрэг дутуу гарч, "зөрүүтэй байна"
// гэсэн эргэлзээ төрүүлж байв.
const accruedInterest = (item: any) => {
  if (!item.interestRate) return 0;
  return item.amount * (item.interestRate / 100) * (accruedDays(item) / 30);
};

// Хугацаа хэтэрсэн гэдгийг статусаас үл хамааран дуусах огноогоор шууд
// тодорхойлно — хэрэглэгч статусыг гараар "Хэтэрсэн" болгож шинэчлээгүй
// байсан ч дуусах хугацаа өнгөрсөн бол шүүлтүүрт харагдана. Аль хэдийн
// "Төлөгдсөн" болсон бичлэгийг оруулахгүй.
const isOverdue = (item: any) => {
  if (!item.dueDate || item.status === "paid") return false;
  const due = new Date(item.dueDate).getTime();
  return !Number.isNaN(due) && due < Date.now();
};

const PAGE_SIZE = 20;

type SortKey = "index" | "counterparty" | "type" | "amount" | "interestRate" | "accruedInterest" | "dueDate" | "status";

const sortValue = (item: any, idx: number, key: SortKey): string | number => {
  switch (key) {
    case "index": return idx;
    case "counterparty": return (item.counterparty || "").toLowerCase();
    case "type": return item.type;
    case "amount": return item.amount;
    case "interestRate": return item.interestRate || 0;
    case "accruedInterest": return accruedInterest(item);
    case "dueDate": return item.dueDate ? new Date(item.dueDate).getTime() : 0;
    case "status": return item.status;
  }
};

export default function ReceivablePage() {
  const navigate = useNavigate();
  const { company, isAdmin, user } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();
  const layoutMode = useLayoutMode();

  const statusMap: Record<string, { label: string; cls: string }> = {
    current: { label: t.receivables.statusCurrent, cls: "bg-positive/15 text-positive hover:bg-positive/15" },
    near: { label: t.receivables.statusNear, cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
    overdue: { label: t.receivables.statusOverdue, cls: "bg-negative/15 text-negative hover:bg-negative/15" },
    paid: { label: t.receivables.statusPaid, cls: "bg-muted text-muted-foreground hover:bg-muted" },
  };

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | "receivable" | "loan">("");
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [unitPriceDisplay, setUnitPriceDisplay] = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();

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
    try {
      setItems(await getReceivables());
      setError(null);
    } catch {
      setError(t.receivables.loadError);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (typeFilter && i.type !== typeFilter) return false;
    if (overdueFilter && !isOverdue(i)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!(i.counterparty || "").toLowerCase().includes(q) && !(i.note || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  let sortedFiltered = filtered;
  if (sortKey) {
    const withIdx = filtered.map((i, idx) => ({ i, v: sortValue(i, idx, sortKey) }));
    withIdx.sort((a, b) => {
      const cmp = typeof a.v === "string" && typeof b.v === "string"
        ? a.v.localeCompare(b.v)
        : (a.v as number) - (b.v as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    sortedFiltered = withIdx.map(x => x.i);
  }

  const pageCount = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const pagedFiltered = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [typeFilter, overdueFilter, search, sortKey, sortDir]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => { setSelected(new Set()); }, [typeFilter, overdueFilter, search]);

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
      filtered.length > 0 && filtered.every(i => prev.has(i._id!)) ? new Set() : new Set(filtered.map(i => i._id!))
    );
  };
  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i._id!));

  const receivables = items.filter(i => i.type === "receivable" && i.status !== "paid");
  const loans = items.filter(i => i.type === "loan" && i.status !== "paid");
  const overdueItems = items.filter(i => i.status === "overdue");
  // "Нийт авлага/зээл" — үндсэн дүн (хүүгүй). "Нийт эцсийн дүн" — үндсэн
  // дүн дээр хуримтлагдсан хүүг нэмсэн бодит эцсийн дүн. Авлага Өглөгийн
  // харьцаа нь бодит (хүүтэй) дүн дээр тооцогдоно.
  const totalReceivable = receivables.reduce((s, i) => s + i.amount, 0);
  const totalLoan = loans.reduce((s, i) => s + i.amount, 0);
  const totalReceivableFinal = receivables.reduce((s, i) => s + i.amount + accruedInterest(i), 0);
  const totalLoanFinal = loans.reduce((s, i) => s + i.amount + accruedInterest(i), 0);

  useEffect(() => {
    const lines = [
      `Идэвхтэй шүүлтүүр: ${typeFilter === "" ? "бүгд" : typeFilter === "receivable" ? "авлага" : "зээл"}`,
      `Харагдаж буй мөр: ${filtered.length} / Нийт: ${items.length}`,
      `Нийт авлага: ${fmt(totalReceivable)} (эцсийн дүн ${fmt(totalReceivableFinal)}) | Нийт зээл: ${fmt(totalLoan)} (эцсийн дүн ${fmt(totalLoanFinal)})`,
      `Хугацаа хэтэрсэн: ${overdueItems.length} ш | Цэвэр байрлал: ${fmt(totalReceivableFinal - totalLoanFinal)}`,
    ];
    setAiPageContext({ title: t.receivables.pageTitle, lines });
    return () => setAiPageContext(null);
  }, [typeFilter, filtered.length, items.length, totalReceivable, totalLoan, totalReceivableFinal, totalLoanFinal, overdueItems.length, t]);

  const openCreate = () => {
    setForm({ ...EMPTY }); setEditing(null); setUnitPriceDisplay(""); setAmountDisplay(""); setOpen(true);
  };
  const openEdit = (item: any) => {
    setForm({ ...item, startDate: toDateInputValue(item.startDate), dueDate: toDateInputValue(item.dueDate) }); setEditing(item._id);
    setUnitPriceDisplay(item.unitPrice ? Number(item.unitPrice).toLocaleString("mn-MN") : "");
    setAmountDisplay(item.amount === 0 ? "" : item.amount.toLocaleString("mn-MN"));
    setOpen(true);
  };

  const handleSave = async () => {
    const unitPrice = Number(form.unitPrice || 0);
    const amount = Number(form.amount || unitPrice);
    const payload = { ...form, unitPrice, amount };
    if (!payload.counterparty.trim()) { toast.error(t.receivables.counterpartyRequired); return; }
    if (payload.amount === 0) { toast.error(t.receivables.amountRequired); return; }
    setSaving(true);
    try {
      addRecent("receivables", "counterparty", payload.counterparty);
      addRecent("receivables", "note", payload.note);
      setForm(payload);
      if (editing) {
        const updated = await updateReceivable(editing, payload);
        setItems(prev => prev.map(i => i._id === editing ? updated : i));
      } else {
        const created = await createReceivable(payload);
        setItems(prev => [created, ...prev]);
      }
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.receivables.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteReceivable(id);
    setItems(prev => prev.filter(i => i._id !== id));
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => deleteReceivable(id)));
      setItems(prev => prev.filter(i => !selected.has(i._id!)));
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.receivables.saveError);
    }
  };

  // Хүснэгтэн дэх мөр бүрийн төлвийг цонх нээхгүйгээр шууд солих.
  const handleInlineStatusChange = async (item: any, next: string) => {
    setOpenStatusId(null);
    try {
      const updated = await updateReceivable(item._id, { ...item, status: next });
      setItems(prev => prev.map(x => x._id === item._id ? updated : x));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.receivables.saveError);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/receivables/export?locale=${locale}`, {
        headers: { Authorization: `Bearer ${token}`, "X-Service-Key": "pnl-app" },
      });
      if (!res.ok) throw new Error(t.dashboard.exportErrorAlert);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "receivables.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { toast.error(t.dashboard.exportErrorAlert); }
    finally { setExporting(false); }
  };

  const { widths: colWidths, startResize } = useResizableColumns("receivables", {
    index: 44, counterparty: 150, type: 110, amount: 130, interestRate: 120, accruedInterest: 130, dueDate: 120, status: 110,
  });

  const headerActions = (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
        <Download className="w-4 h-4 mr-1.5" />
        {exporting ? t.common.exportingLabel : t.common.excelExport}
      </Button>
      <Button onClick={openCreate} size="sm"
        className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
        <Plus className="w-4 h-4 mr-1.5" /> {t.receivables.add}
      </Button>
      <BackToPortalLink />
      <LogoutButton />
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
              <ArrowLeftRight className="w-5 h-5" /> {t.receivables.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.receivables.pageSubtitle}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" /> {t.receivables.pageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">{t.receivables.pageSubtitle}</p>
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
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 my-2 text-xs rounded-full transition-colors whitespace-nowrap ${
                    active ? "nav-pill-active font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.receivables.statTotalReceivable}</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{fmt(totalReceivable)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">
              {format(t.receivables.counterpartyCount, { count: String(receivables.length) })}
            </p>
          </div>
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.receivables.statTotalLoan}</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{fmt(totalLoan)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">
              {format(t.receivables.loanCount, { count: String(loans.length) })}
            </p>
          </div>
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.receivables.statOverdue}</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{overdueItems.length}</p>
            <p className="relative text-xs text-muted-foreground mt-1 blur-number">
              {fmt(overdueItems.reduce((s, i) => s + i.amount, 0))}
            </p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.receivables.statTotalReceivableFinal}</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{fmt(totalReceivableFinal)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.receivables.totalFinalSub}</p>
          </div>
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.receivables.statTotalLoanFinal}</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{fmt(totalLoanFinal)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.receivables.totalFinalSub}</p>
          </div>
          <div className={`glass-card ${totalReceivableFinal - totalLoanFinal >= 0 ? "glass-card-positive" : "glass-card-negative"} px-4 py-3`}>
            <p className="relative text-xs text-muted-foreground mb-1">{t.receivables.statNetPosition}</p>
            <p className={`relative text-xl font-semibold stat-number ${totalReceivableFinal - totalLoanFinal >= 0 ? "text-positive" : "text-negative"}`}>
              {fmt(totalReceivableFinal - totalLoanFinal)}
            </p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.receivables.netPositionSub}</p>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-positive/60" />
              <p className="text-xs font-medium text-positive">
                {format(t.receivables.selectedCount, { count: String(selected.size) })}
              </p>
              <div className="ml-auto flex items-center gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-xs text-destructive hover:text-destructive/80">
                      {t.receivables.bulkDeleteButton}
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {format(t.receivables.bulkDeleteConfirmDesc, { count: String(selected.size) })}
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
                  {t.receivables.deselect}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.receivables.searchPlaceholder}
              className="h-8 w-56 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {(["", "receivable", "loan"] as const).map(f => (
            <button key={f} onClick={() => startTransition(() => setTypeFilter(f))}
              className={`h-8 px-3 text-xs rounded-lg border ${typeFilter === f
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {f === "" ? t.common.all : f === "receivable" ? t.receivables.typeReceivable : t.receivables.typeLoan}
            </button>
          ))}
          <span className="w-px h-5 bg-border" />
          <button onClick={() => setOverdueFilter(v => !v)}
            className={`h-8 px-3 text-xs rounded-lg border ${overdueFilter
              ? "bg-negative/15 text-negative border-negative/30"
              : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
            {t.receivables.filterOverdue}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">{t.receivables.noRecords}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" />
                {exporting ? t.common.exportingLabel : t.common.excelExport}
              </Button>
              <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">{t.receivables.addFirstRecord}</Button>
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
                  <ResizableHead label={t.receivables.colIndex} width={colWidths.index} onResizeStart={startResize("index")} sortActive={sortKey === "index"} sortDir={sortDir} onSort={() => toggleSort("index")} />
                  <ResizableHead label={t.receivables.colCounterparty} width={colWidths.counterparty} onResizeStart={startResize("counterparty")} sortActive={sortKey === "counterparty"} sortDir={sortDir} onSort={() => toggleSort("counterparty")} />
                  <ResizableHead label={t.receivables.colType} width={colWidths.type} onResizeStart={startResize("type")} sortActive={sortKey === "type"} sortDir={sortDir} onSort={() => toggleSort("type")} />
                  <ResizableHead label={t.receivables.colAmount} width={colWidths.amount} onResizeStart={startResize("amount")} align="right" sortActive={sortKey === "amount"} sortDir={sortDir} onSort={() => toggleSort("amount")} />
                  <ResizableHead label={t.receivables.colInterestRate} width={colWidths.interestRate} onResizeStart={startResize("interestRate")} align="right" sortActive={sortKey === "interestRate"} sortDir={sortDir} onSort={() => toggleSort("interestRate")} />
                  <ResizableHead label={t.receivables.colAccruedInterest} width={colWidths.accruedInterest} onResizeStart={startResize("accruedInterest")} align="right" sortActive={sortKey === "accruedInterest"} sortDir={sortDir} onSort={() => toggleSort("accruedInterest")} />
                  <ResizableHead label={t.receivables.colDueDate} width={colWidths.dueDate} onResizeStart={startResize("dueDate")} sortActive={sortKey === "dueDate"} sortDir={sortDir} onSort={() => toggleSort("dueDate")} />
                  <ResizableHead label={t.receivables.colStatus} width={colWidths.status} onResizeStart={startResize("status")} sortActive={sortKey === "status"} sortDir={sortDir} onSort={() => toggleSort("status")} />
                  <TableHead className="text-right px-1.5 whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.receivables.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFiltered.map((item, i) => {
                  const idx = (page - 1) * PAGE_SIZE + i;
                  return (
                  <TableRow key={item._id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="px-1.5">
                      <input type="checkbox" checked={selected.has(item._id!)} onChange={() => toggleOne(item._id!)} className="w-4 h-4 cursor-pointer accent-positive" />
                    </TableCell>
                    <TableCell className="px-1.5 text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell className="px-1.5 font-medium blur-number">{item.counterparty}</TableCell>
                    <TableCell className="px-1.5">
                      <Badge className={item.type === "receivable"
                        ? "bg-positive/15 text-positive hover:bg-positive/15"
                        : "bg-negative/15 text-negative hover:bg-negative/15"}>
                        {item.type === "receivable" ? t.receivables.typeReceivable : t.receivables.typeLoan}
                      </Badge>
                    </TableCell>
                    <TableCell className={`px-1.5 text-right font-medium stat-number ${item.type === "receivable" ? "text-positive" : "text-negative"}`}>
                      {fmt(item.amount)}
                    </TableCell>
                    <TableCell className="px-1.5 text-right text-muted-foreground">
                      {item.interestRate > 0 ? `${item.interestRate}%` : "—"}
                    </TableCell>
                    <TableCell className="px-1.5 text-right text-muted-foreground stat-number">
                      {item.interestRate > 0 ? (
                        <>
                          {fmt(accruedInterest(item))}
                          <div className="text-[10px] font-normal">{format(t.receivables.accruedDaysLabel, { days: Math.floor(accruedDays(item)).toString() })}</div>
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="px-1.5 text-muted-foreground text-sm">{fmtDate(item.dueDate)}</TableCell>
                    <TableCell className="px-1.5">
                      <div className="relative inline-block">
                        <button type="button"
                          onClick={() => setOpenStatusId(openStatusId === item._id ? null : item._id!)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusMap[item.status].cls}`}>
                          {statusMap[item.status].label}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                        {openStatusId === item._id && (
                          <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 min-w-32">
                            {(["current", "near", "overdue", "paid"] as const).map(s => (
                              <button key={s} type="button" onClick={() => handleInlineStatusChange(item, s)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left">
                                <Badge className={statusMap[s].cls}>{statusMap[s].label}</Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
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
                              <AlertDialogDescription>{t.receivables.deleteConfirmDesc}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item._id)}
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
            <DialogTitle>{editing ? t.receivables.editTitle : t.receivables.newTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.type}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="receivable">{t.receivables.typeReceivable}</option>
                  <option value="loan">{t.receivables.typeLoan}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.status}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="current">{t.receivables.statusCurrent}</option>
                  <option value="near">{t.receivables.statusNear}</option>
                  <option value="overdue">{t.receivables.statusOverdue}</option>
                  <option value="paid">{t.receivables.statusPaid}</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {form.type === "receivable" ? t.receivables.counterpartyReceivable : t.receivables.counterpartyLoan}
                </label>
                <Combobox
                  value={form.counterparty}
                  onChange={(v) => setForm(f => ({ ...f, counterparty: v }))}
                  options={getRecent("receivables", "counterparty")}
                  placeholder={form.type === "receivable" ? t.receivables.counterpartyPlaceholderReceivable : t.receivables.counterpartyPlaceholderLoan} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.unitPrice}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={unitPriceDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setUnitPriceDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, unitPrice: num, amount: num }));
                    setAmountDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.interestRate}</label>
                <input type="number" min={0} step={0.1}
                  className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: Number(e.target.value) }))} />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.totalAmount}</label>
                <input readOnly className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right text-muted-foreground"
                  value={amountDisplay} placeholder="0" />
                {editing && (form as any).interestRate > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {format(t.receivables.accruedInterestNote, {
                      amount: fmt(accruedInterest(form)),
                      days: Math.floor(accruedDays(form)).toString(),
                    })}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.startDate}</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.dueDate}</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.note}</label>
                <Combobox
                  value={form.note}
                  onChange={(v) => setForm(f => ({ ...f, note: v }))}
                  options={getRecent("receivables", "note")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !form.counterparty.trim() || form.amount === 0}
              className="bg-positive text-background hover:bg-positive/90">
              {saving ? t.common.saving : editing ? t.common.save : t.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
