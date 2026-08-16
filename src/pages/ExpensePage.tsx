import { useEffect, useState, useCallback, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "@/lib/expense";
import { fmtDate, toDateInputValue } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLocale, format } from "@/hooks/useLocale";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LayoutToggleButton } from "@/components/LayoutToggleButton";
import { LogoutButton } from "@/components/LogoutButton";
import { BackToPortalLink } from "@/components/BackToPortalLink";
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
import { TableIcon, Plus, Pencil, Trash2, ChevronLeft, ChevronDown, Receipt, BarChart2, Users, Box, ArrowLeftRight, Download, ShieldCheck, HardHat, Handshake, Package } from "lucide-react";
import { mergeCategories, addCustomCategory } from "@/lib/customCategories";
import { getRecent, addRecent } from "@/lib/recentValues";
import { toast } from "@/lib/toast";
import { setAiPageContext } from "@/lib/aiPageContext";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";
import { Combobox } from "@/components/ui/combobox";

// Чөлөөт текст утга — backend-д хадгалагддаг тул хэлээр орчуулахгүй.
const OFFICE_CATS = ["Оффис", "Тоног төхөөрөмж", "Цахилгаан, интернет", "Тээвэр, шатахуун", "Татвар, хураамж", "Бусад"];
const OTHER_CATS = ["Маркетинг", "Аялал, томилолт", "Сургалт", "Хуулийн зардал", "Эрүүл мэндийн зардал", "Бусад"];

const EMPTY = {
  type: "office" as "office" | "other",
  category: "Оффис", description: "",
  unitPrice: 0, quantity: 1, amount: 0, date: new Date().toISOString().split("T")[0],
  status: "pending" as "approved" | "pending" | "rejected", note: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

const PAGE_SIZE = 20;

type SortKey = "date" | "type" | "category" | "description" | "amount" | "status";

// Баганын толгой дээр дарахад ижил утгатай мөрүүд зэрэгцэн эрэмбэлэгдэж харагдана.
const sortValue = (e: any, key: SortKey): string | number => {
  switch (key) {
    case "date": return new Date(e.date).getTime();
    case "type": return e.type;
    case "category": return (e.category || "").toLowerCase();
    case "description": return (e.description || "").toLowerCase();
    case "amount": return e.amount;
    case "status": return e.status;
  }
};

export default function ExpensePage() {
  const navigate = useNavigate();
  const { company, isAdmin, user } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();
  const layoutMode = useLayoutMode();

  const statusMap: Record<string, { label: string; cls: string }> = {
    approved: { label: t.expenses.statusApproved, cls: "bg-positive/15 text-positive hover:bg-positive/15" },
    pending: { label: t.expenses.statusPending, cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
    rejected: { label: t.expenses.statusRejected, cls: "bg-negative/15 text-negative hover:bg-negative/15" },
  };

  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | "office" | "other">("");
  const [unitPriceDisplay, setUnitPriceDisplay] = useState("");
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [amountDisplay, setAmountDisplay] = useState("");
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
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
    try {
      setExpenses(await getExpenses());
      setError(null);
    } catch {
      setError(t.expenses.loadError);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = typeFilter ? expenses.filter(e => e.type === typeFilter) : expenses;
  const totalApproved = filtered.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const totalPending = filtered.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const officeTotal = expenses.filter(e => e.type === "office" && e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const otherTotal = expenses.filter(e => e.type === "other" && e.status === "approved").reduce((s, e) => s + e.amount, 0);

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

  useEffect(() => { setPage(1); }, [typeFilter, sortKey, sortDir]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  useEffect(() => { setSelected(new Set()); }, [typeFilter]);

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
  const selectedExpenses = filtered.filter(e => selected.has(e._id!));
  const selectedAmount = selectedExpenses.reduce((s, e) => s + e.amount, 0);

  useEffect(() => {
    const lines = [
      `Идэвхтэй шүүлтүүр: ${typeFilter === "" ? "бүгд" : typeFilter === "office" ? "оффис" : "бусад"}`,
      `Харагдаж буй мөр: ${filtered.length} / Нийт: ${expenses.length}`,
      `Батлагдсан: ${fmt(totalApproved)} | Хүлээгдэж буй: ${fmt(totalPending)}`,
      `Оффис зардал (батлагдсан): ${fmt(officeTotal)} | Бусад зардал (батлагдсан): ${fmt(otherTotal)}`,
    ];
    setAiPageContext({ title: t.expenses.pageTitle, lines });
    return () => setAiPageContext(null);
  }, [typeFilter, filtered.length, expenses.length, totalApproved, totalPending, officeTotal, otherTotal, t]);

  const openCreate = () => {
    setForm({ ...EMPTY }); setEditing(null); setUnitPriceDisplay(""); setQuantityInput(1); setAmountDisplay(""); setOpen(true);
  };
  const openEdit = (exp: any) => {
    setForm({ ...exp, date: toDateInputValue(exp.date) }); setEditing(exp._id);
    setUnitPriceDisplay(exp.unitPrice ? Number(exp.unitPrice).toLocaleString("mn-MN") : "");
    setQuantityInput(exp.quantity || 1);
    setAmountDisplay(exp.amount === 0 ? "" : exp.amount.toLocaleString("mn-MN"));
    setOpen(true);
  };

  const handleSave = async () => {
    const quantity = Math.max(1, Number(form.quantity || 1));
    const unitPrice = Number(form.unitPrice || 0);
    const amount = Number(form.amount || unitPrice * quantity);
    const payload = { ...form, unitPrice, quantity, amount };
    if (!payload.description.trim() || payload.amount === 0) return;
    setSaving(true);
    try {
      addCustomCategory(payload.type === "office" ? "expenses_office" : "expenses_other", payload.category);
      addRecent("expenses", "description", payload.description);
      addRecent("expenses", "note", payload.note);
      setForm(payload);
      if (editing) {
        const updated = await updateExpense(editing, payload);
        setExpenses(prev => prev.map(e => e._id === editing ? updated : e));
      } else {
        const created = await createExpense(payload);
        setExpenses(prev => [created, ...prev]);
      }
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.expenses.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e._id !== id));
  };

  // Хүснэгтэн дэх мөр бүрийн төлвийг цонх нээхгүйгээр шууд солих.
  const handleInlineStatusChange = async (exp: any, next: string) => {
    setOpenStatusId(null);
    try {
      const updated = await updateExpense(exp._id, { ...exp, status: next });
      setExpenses(prev => prev.map(x => x._id === exp._id ? updated : x));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.expenses.saveError);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => deleteExpense(id)));
      setExpenses(prev => prev.filter(e => !selected.has(e._id!)));
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.expenses.saveError);
    }
  };

  const cats = mergeCategories(
    form.type === "office" ? OFFICE_CATS : OTHER_CATS,
    form.type === "office" ? "expenses_office" : "expenses_other"
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/expenses/export?locale=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t.dashboard.exportErrorAlert);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "expenses.xlsx";
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
        <Plus className="w-4 h-4 mr-1.5" /> {t.expenses.addExpense}
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
              <Receipt className="w-5 h-5" /> {t.expenses.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.expenses.pageSubtitle}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium flex items-center gap-2">
                <Receipt className="w-5 h-5" /> {t.expenses.pageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">{t.expenses.pageSubtitle}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.expenses.statApprovedTotal}</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{fmt(totalApproved)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">
              {format(t.expenses.expenseCount, { count: String(filtered.filter(e => e.status === "approved").length) })}
            </p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.expenses.statPending}</p>
            <p className="relative text-xl font-semibold text-warn stat-number">{fmt(totalPending)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">
              {format(t.expenses.expenseCount, { count: String(filtered.filter(e => e.status === "pending").length) })}
            </p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.expenses.statOffice}</p>
            <p className="relative text-xl font-semibold stat-number">{fmt(officeTotal)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.expenses.approved}</p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.expenses.statOther}</p>
            <p className="relative text-xl font-semibold stat-number">{fmt(otherTotal)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.expenses.approved}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(["", "office", "other"] as const).map(f => (
            <button key={f} onClick={() => startTransition(() => setTypeFilter(f))}
              className={`h-8 px-3 text-xs rounded-lg border ${typeFilter === f
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {f === "" ? t.common.all : f === "office" ? t.expenses.typeOffice : t.expenses.typeOther}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full bg-positive/60" />
            <p className="text-xs font-medium text-positive">
              {format(t.expenses.selectedCount, { count: String(selected.size) })}
            </p>
            <p className="text-xs text-muted-foreground stat-number">{fmt(selectedAmount)}</p>
            <div className="ml-auto flex items-center gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-destructive hover:text-destructive/80">
                    {t.expenses.bulkDeleteButton}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {format(t.expenses.bulkDeleteConfirmDesc, { count: String(selected.size) })}
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
                {t.expenses.deselect}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">{t.expenses.noExpenses}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" />
                {exporting ? t.common.exportingLabel : t.common.excelExport}
              </Button>
              <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">{t.expenses.addFirstExpense}</Button>
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
                  <SortableHead sortKeyName="date" label={t.expenses.colDate} />
                  <SortableHead sortKeyName="type" label={t.expenses.colType} />
                  <SortableHead sortKeyName="category" label={t.expenses.colCategory} />
                  <SortableHead sortKeyName="description" label={t.expenses.colDescription} />
                  <SortableHead sortKeyName="amount" label={t.expenses.colAmount} align="right" />
                  <SortableHead sortKeyName="status" label={t.expenses.colStatus} />
                  <TableHead className="text-right px-1.5 whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.expenses.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFiltered.map(exp => (
                  <TableRow key={exp._id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="px-1.5">
                      <input type="checkbox" checked={selected.has(exp._id!)} onChange={() => toggleOne(exp._id!)} className="w-4 h-4 cursor-pointer accent-positive" />
                    </TableCell>
                    <TableCell className="px-1.5 text-muted-foreground text-sm">{fmtDate(exp.date)}</TableCell>
                    <TableCell className="px-1.5">
                      <Badge className={exp.type === "office"
                        ? "bg-info/15 text-info hover:bg-info/15"
                        : "bg-[oklch(0.6_0.18_300)]/15 text-[oklch(0.6_0.18_300)] hover:bg-[oklch(0.6_0.18_300)]/15"}>
                        {exp.type === "office" ? t.expenses.typeOffice : t.expenses.typeOther}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-1.5 text-muted-foreground text-sm">{exp.category}</TableCell>
                    <TableCell className="px-1.5 font-medium">{exp.description}</TableCell>
                    <TableCell className="px-1.5 text-right font-medium text-negative stat-number">{fmt(exp.amount)}</TableCell>
                    <TableCell className="px-1.5">
                      <div className="relative inline-block">
                        <button type="button"
                          onClick={() => setOpenStatusId(openStatusId === exp._id ? null : exp._id!)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusMap[exp.status].cls}`}>
                          {statusMap[exp.status].label}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                        {openStatusId === exp._id && (
                          <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 min-w-32">
                            {(["pending", "approved", "rejected"] as const).map(s => (
                              <button key={s} type="button" onClick={() => handleInlineStatusChange(exp, s)}
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
                        <Button variant="ghost" size="icon" onClick={() => openEdit(exp)}>
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
                              <AlertDialogDescription>{t.expenses.deleteConfirmDesc}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(exp._id)}
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
            <DialogTitle>{editing ? t.expenses.editExpense : t.expenses.addExpense}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.type}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any, category: e.target.value === "office" ? OFFICE_CATS[0] : OTHER_CATS[0] }))}>
                  <option value="office">{t.expenses.typeOffice}</option>
                  <option value="other">{t.expenses.typeOther}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.category}</label>
                <Combobox
                  value={form.category}
                  onChange={(v) => setForm(f => ({ ...f, category: v }))}
                  options={cats}
                  placeholder={t.transactions.categoryAddNewPlaceholder} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.description}</label>
                <Combobox
                  value={form.description}
                  onChange={(v) => setForm(f => ({ ...f, description: v }))}
                  options={getRecent("expenses", "description")}
                  placeholder={t.expenses.descriptionPlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.unitPrice}</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={unitPriceDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setUnitPriceDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => {
                      const qty = f.quantity || quantityInput || 1;
                      const amount = num * qty;
                      return { ...f, unitPrice: num, amount, quantity: qty };
                    });
                    setAmountDisplay(() => {
                      const qty = quantityInput || 1;
                      const total = (Number(raw) || 0) * qty;
                      return total === 0 ? "" : total.toLocaleString("mn-MN");
                    });
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.quantity}</label>
                <input type="number" min={1} className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  value={quantityInput}
                  onChange={e => {
                    const q = Math.max(1, Number(e.target.value) || 1);
                    setQuantityInput(q);
                    setForm(f => {
                      const unit = f.unitPrice || (Number(unitPriceDisplay.replace(/[^0-9]/g, "")) || 0);
                      const amount = unit * q;
                      return { ...f, quantity: q, amount };
                    });
                    setAmountDisplay(() => {
                      const unit = Number(unitPriceDisplay.replace(/[^0-9]/g, "")) || 0;
                      const total = unit * q;
                      return total === 0 ? "" : total.toLocaleString("mn-MN");
                    });
                  }} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.totalAmount}</label>
                <input readOnly className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right text-muted-foreground"
                  value={amountDisplay} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.date}</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.status}</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="pending">{t.expenses.statusPending}</option>
                  <option value="approved">{t.expenses.statusApproved}</option>
                  <option value="rejected">{t.expenses.statusRejected}</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.expenses.note}</label>
                <Combobox
                  value={form.note}
                  onChange={(v) => setForm(f => ({ ...f, note: v }))}
                  options={getRecent("expenses", "note")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !form.description.trim() || form.amount === 0}
              className="bg-positive text-background hover:bg-positive/90">
              {saving ? t.common.saving : editing ? t.common.save : t.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
