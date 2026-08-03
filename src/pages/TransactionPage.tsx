import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import {
  getTransactions, getContractSummary, importTransactions,
  exportTransactions, deleteTransaction, createTransaction, updateTransaction,
} from "@/lib/transaction";
import { Transaction, ContractSummary } from "@/types";
import { setAiPageContext } from "@/lib/aiPageContext";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogOut, ChevronLeft, BarChart2, TableIcon, Upload, Download, Search,
  FileText, TrendingUp, TrendingDown, X, Trash2, Plus, Users, Box, Receipt,
  ArrowLeftRight, Pencil, ShieldCheck,
} from "lucide-react";

const fmt = (n: number) => "₮" + Math.round(Math.abs(n)).toLocaleString("mn-MN");
const fmtSigned = (n: number) => (n >= 0 ? "+" : "-") + fmt(n);

const formatAmount = (raw: string): string => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("mn-MN");
};
const parseAmount = (formatted: string): number =>
  parseFloat(formatted.replace(/[^0-9]/g, "")) || 0;

const CATEGORIES_INC = ["Борлуулалт", "Зээл буцаалт", "Хүүгийн орлого", "Бусад орлого"];
const CATEGORIES_EXP = ["Цалин", "НД / Татвар", "Түрээс", "Тээвэр", "Материал", "Татвар", "Зээл", "Эмчилгээ", "Офис", "Бусад"];

type Tab = "range" | "contract";

interface NewTx {
  date: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  category: string;
  contractNumber: string;
  note: string;
}

const EMPTY_TX: NewTx = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  amount: "",
  type: "income",
  category: "Борлуулалт",
  contractNumber: "",
  note: "",
};

export default function TransactionPage() {
  const navigate = useNavigate();
  const { company, isAdmin } = useAuth();
  const location = useLocation();

  const [tab, setTab] = useState<Tab>("range");
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, incomeCount: 0, expenseCount: 0 });

  const [showModal, setShowModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [newTx, setNewTx] = useState<NewTx>(EMPTY_TX);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [contractInput, setContractInput] = useState("");
  const [contractData, setContractData] = useState<ContractSummary | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractNotFound, setContractNotFound] = useState(false);

  const NAV_ITEMS = [
    { path: "/dashboard", label: "P&L Тайлан", icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: "Ажилчид & Цалин", icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: "Хөрөнгө", icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: "Зардал", icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: "Зээл & Авлага", icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/transactions", label: "Гүйлгээний дэвтэр", icon: <TableIcon className="w-4 h-4" /> },
    ...(isAdmin ? [{ path: "/admin/users", label: "Админ", icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadTxs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTransactions({
        type: typeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setTxs(data.transactions);
      setTotalPages(data.totalPages);
      setTotalCount(data.total);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, dateFrom, dateTo, debouncedSearch, page]);

  useEffect(() => { loadTxs(); }, [loadTxs]);

  useEffect(() => { setPage(1); }, [typeFilter, dateFrom, dateTo, debouncedSearch]);

  const totalInc = summary.totalIncome;
  const totalExp = summary.totalExpense;
  const netAmount = totalInc - totalExp;
  const filtered = txs;

  // ── AI ассистентэд одоо дэлгэц дээр харагдаж байгаа тоог дамжуулна ──
  // Цэвэр дүн нь шүүлтүүрээс хамаардаг тул шүүлтүүрийг ч хамт бичнэ —
  // эс бөгөөс модель ямар хугацааны дүн болохыг мэдэхгүй.
  useEffect(() => {
    const mnt = (n: number) => Math.round(n).toLocaleString("mn-MN") + "₮";
    const lines: string[] = [];

    if (tab === "range") {
      lines.push(
        "Сонгосон таб: Хугацаагаар",
        `Хугацааны шүүлтүүр: ${dateFrom || "хязгааргүй"} — ${dateTo || "хязгааргүй"}`,
        `Төрлийн шүүлтүүр: ${typeFilter === "" ? "Бүгд" : typeFilter === "income" ? "Орлого" : "Зарлага"}`,
        `Хайлт: ${debouncedSearch ? `"${debouncedSearch}"` : "байхгүй"}`,
        `Нийт гүйлгээ: ${totalCount} (${summary.incomeCount} орлого · ${summary.expenseCount} зарлага)`,
        `Орлого: ${mnt(totalInc)}`,
        `Зарлага: ${mnt(totalExp)}`,
        `ЦЭВЭР ДҮН: ${netAmount >= 0 ? "+" : "-"}${mnt(Math.abs(netAmount))} — ${netAmount >= 0 ? "Ашигтай" : "Алдагдалтай"}`,
        "(Эдгээр дүн нь дээрх шүүлтүүрт тохирох БҮХ гүйлгээ дээр тооцоологдсон, зөвхөн харагдаж байгаа хуудас биш.)"
      );
    } else if (contractData) {
      lines.push(
        "Сонгосон таб: Гэрээний дугаараар",
        `Гэрээний дугаар: ${contractData.contractNumber}`,
        `Нийт орлого: ${mnt(contractData.totalIncome)} (${contractData.incomeCount} гүйлгээ)`,
        `Нийт зарлага: ${mnt(contractData.totalExpense)} (${contractData.expenseCount} гүйлгээ)`,
        `ЦЭВЭР АШИГ: ${contractData.netProfit >= 0 ? "+" : "-"}${mnt(Math.abs(contractData.netProfit))} — ` +
          `${contractData.netProfit >= 0 ? "Ашигтай" : "Алдагдалтай"}, маржин ${contractData.margin}%`
      );
    } else {
      lines.push("Сонгосон таб: Гэрээний дугаараар — хэрэглэгч гэрээ хайгаагүй байна.");
    }

    setAiPageContext({ title: "Гүйлгээний дэвтэр", lines });
    return () => setAiPageContext(null);
  }, [
    tab, dateFrom, dateTo, typeFilter, debouncedSearch,
    totalCount, totalInc, totalExp, netAmount,
    summary.incomeCount, summary.expenseCount, contractData,
  ]);

  const setQuick = (from: string, to: string) => { setDateFrom(from); setDateTo(to); };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importTransactions(file);
      setImportResult(result);
      loadTxs();
    } catch {
      alert("Import алдаа гарлаа");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTransactions({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
    } catch {
      alert("Export алдаа гарлаа");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    loadTxs();
  };

  const handleSave = async () => {
    setSaveError("");
    if (!newTx.description.trim()) { setSaveError("Тайлбар оруулна уу"); return; }
    const amount = parseAmount(newTx.amount);
    if (!amount || amount <= 0) { setSaveError("Дүн оруулна уу"); return; }
    setSaving(true);
    try {
      const payload = {
        date: newTx.date,
        description: newTx.description.trim(),
        amount,
        type: newTx.type,
        category: newTx.category,
        contractNumber: newTx.contractNumber.trim().toUpperCase(),
        note: newTx.note.trim(),
        currency: "₮",
        status: "approved",
      };
      if (editingTxId) {
        await updateTransaction(editingTxId, payload);
      } else {
        await createTransaction(payload);
        setPage(1);
      }
      setShowModal(false);
      setEditingTxId(null);
      setNewTx(EMPTY_TX);
      loadTxs();
    } catch {
      setSaveError("Хадгалах үед алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  const openModal = () => {
    setEditingTxId(null);
    setNewTx(EMPTY_TX);
    setSaveError("");
    setShowModal(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTxId(tx._id!);
    setNewTx({
      date: tx.date,
      description: tx.description,
      amount: formatAmount(String(tx.amount)),
      type: tx.type,
      category: tx.category,
      contractNumber: tx.contractNumber ?? "",
      note: tx.note ?? "",
    });
    setSaveError("");
    setShowModal(true);
  };

  const searchContract = async () => {
    const num = contractInput.trim().toUpperCase();
    if (!num) return;
    setContractLoading(true);
    setContractData(null);
    setContractNotFound(false);
    try {
      const data = await getContractSummary(num);
      setContractData(data);
    } catch {
      setContractNotFound(true);
    } finally {
      setContractLoading(false);
    }
  };

  const handleContractExport = async () => {
    if (!contractData) return;
    try { await exportTransactions({ contractNumber: contractData.contractNumber }); }
    catch { alert("Export алдаа"); }
  };

  const categories = newTx.type === "income" ? CATEGORIES_INC : CATEGORIES_EXP;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-medium flex items-center gap-2">
              <TableIcon className="w-5 h-5" /> Гүйлгээний дэвтэр
            </h1>
            <p className="text-xs text-muted-foreground">Excel import · Гэрээний дугаарын хайлт</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="w-4 h-4 mr-1.5" />
            {importing ? "Уншиж байна..." : "Excel оруулах"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Боловсруулж..." : "Excel татах"}
          </Button>
          <Button size="sm" onClick={openModal}
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> Шинэ гүйлгээ
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1.5" /> Гарах
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <nav className="border-b border-border/50 px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-xl border border-border/50 w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <h2 className="text-base font-semibold flex items-center gap-2">
                {editingTxId
                  ? <><Pencil className="w-5 h-5 text-info" /> Гүйлгээ засах</>
                  : <><Plus className="w-5 h-5 text-positive" /> Шинэ гүйлгээ нэмэх</>}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-2">
                {(["income", "expense"] as const).map(t => (
                  <button key={t} onClick={() => {
                    setNewTx(prev => ({
                      ...prev,
                      type: t,
                      category: t === "income" ? CATEGORIES_INC[0] : CATEGORIES_EXP[0],
                    }));
                  }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                      newTx.type === t
                        ? t === "income"
                          ? "border-positive bg-positive/10 text-positive"
                          : "border-negative bg-negative/10 text-negative"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}>
                    {t === "income"
                      ? <span className="flex items-center justify-center gap-1.5"><TrendingUp className="w-4 h-4" />Орлого</span>
                      : <span className="flex items-center justify-center gap-1.5"><TrendingDown className="w-4 h-4" />Зарлага</span>}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Огноо *</Label>
                  <Input type="date" value={newTx.date}
                    onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))}
                    className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Дүн (₮) *</Label>
                  <Input
                    value={newTx.amount}
                    onChange={e => setNewTx(p => ({ ...p, amount: formatAmount(e.target.value) }))}
                    placeholder="0"
                    className="h-9 text-sm text-right font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Тайлбар *</Label>
                <Input
                  value={newTx.description}
                  onChange={e => setNewTx(p => ({ ...p, description: e.target.value }))}
                  placeholder="Гүйлгээний тайлбар..."
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ангилал</Label>
                  <select
                    value={newTx.category}
                    onChange={e => setNewTx(p => ({ ...p, category: e.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Гэрээний дугаар</Label>
                  <Input
                    value={newTx.contractNumber}
                    onChange={e => setNewTx(p => ({ ...p, contractNumber: e.target.value.toUpperCase() }))}
                    placeholder="GCR-2026-001"
                    className="h-9 text-sm font-mono tracking-wide"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Тэмдэглэл</Label>
                <Input
                  value={newTx.note}
                  onChange={e => setNewTx(p => ({ ...p, note: e.target.value }))}
                  placeholder="Нэмэлт тэмдэглэл..."
                  className="h-9 text-sm"
                />
              </div>

              {saveError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-destructive">
                  {saveError}
                </div>
              )}

              {newTx.amount && parseAmount(newTx.amount) > 0 && (
                <div className={`rounded-xl px-4 py-3 text-center ${newTx.type === "income" ? "bg-positive/10" : "bg-negative/10"}`}>
                  <p className="text-xs text-muted-foreground mb-1">{newTx.type === "income" ? "Орлого" : "Зарлага"}</p>
                  <p className={`text-2xl font-semibold ${newTx.type === "income" ? "text-positive" : "text-negative"}`}>
                    {newTx.type === "income" ? "+" : "-"}₮{parseAmount(newTx.amount).toLocaleString("mn-MN")}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-border/50 bg-secondary/30">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                Цуцлах
              </Button>
              <Button
                className={`flex-1 text-background ${newTx.type === "income" ? "bg-positive hover:bg-positive/90" : "bg-info hover:bg-info/90"}`}
                onClick={handleSave}
                disabled={saving}>
                {saving ? "Хадгалж байна..." : "Хадгалах"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6">
        {importResult && (
          <div className="mb-4 flex items-center gap-3 bg-positive/10 border border-positive/30 rounded-lg px-4 py-2.5">
            <span className="text-sm text-positive font-medium">
              ✓ {importResult.imported} гүйлгээ амжилттай оруулагдлаа
              {importResult.skipped > 0 && ` · ${importResult.skipped} мөр алгасагдлаа`}
            </span>
            <button onClick={() => setImportResult(null)} className="ml-auto text-positive/70 hover:text-positive">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-5 w-fit">
          {(["range", "contract"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t === "range"
                ? <><BarChart2 className="w-3.5 h-3.5" />Хугацаагаар</>
                : <><FileText className="w-3.5 h-3.5" />Гэрээний дугаар</>}
            </button>
          ))}
        </div>

        {tab === "range" && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Нийт гүйлгээ", val: totalCount, sub: `${summary.incomeCount} орлого · ${summary.expenseCount} зарлага`, color: "" },
                { label: "Орлого", val: fmt(totalInc), sub: summary.incomeCount + " гүйлгээ", color: "text-positive" },
                { label: "Зарлага", val: fmt(totalExp), sub: summary.expenseCount + " гүйлгээ", color: "text-negative" },
                { label: "Цэвэр дүн", val: fmtSigned(totalInc - totalExp), sub: totalInc - totalExp >= 0 ? "Ашигтай" : "Алдагдалтай", color: totalInc - totalExp >= 0 ? "text-positive" : "text-negative" },
              ].map(c => (
                <div key={c.label} className="glass-card px-4 py-3">
                  <p className="relative text-xs text-muted-foreground mb-1">{c.label}</p>
                  <p className={`relative text-xl font-semibold stat-number ${c.color}`}>{c.val}</p>
                  <p className="relative text-xs text-muted-foreground mt-1">{c.sub}</p>
                </div>
              ))}
            </div>

            <div className="glass-card px-4 py-3 mb-4">
              <div className="relative flex items-center gap-2 flex-wrap mb-3">
                <span className="text-xs text-muted-foreground">Хугацаа:</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="h-8 px-2 text-xs rounded-lg border border-border bg-background" />
                <span className="text-xs text-muted-foreground">—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="h-8 px-2 text-xs rounded-lg border border-border bg-background" />
                <div className="flex gap-1.5 ml-1 flex-wrap">
                  {[
                    { label: "Q1 2026", from: "2026-01-01", to: "2026-03-31" },
                    { label: "Q2 2026", from: "2026-04-01", to: "2026-06-30" },
                    { label: "Q3 2026", from: "2026-07-01", to: "2026-09-30" },
                    { label: "Q4 2026", from: "2026-10-01", to: "2026-12-31" },
                    { label: "2026 он",  from: "2026-01-01", to: "2026-12-31" },
                  ].map(q => (
                    <button key={q.label} onClick={() => setQuick(q.from, q.to)}
                      className={`h-7 px-2.5 text-xs rounded-full border transition-colors ${
                        dateFrom === q.from && dateTo === q.to
                          ? "bg-positive/15 text-positive border-positive/30"
                          : "bg-background text-muted-foreground border-border hover:bg-secondary/50"
                      }`}>{q.label}</button>
                  ))}
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="h-7 px-2.5 text-xs rounded-full border bg-background text-muted-foreground border-border hover:bg-secondary/50">
                    Бүгд
                  </button>
                </div>
              </div>
              <div className="relative flex items-center gap-2">
                {(["", "income", "expense"] as const).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`h-7 px-3 text-xs rounded-full border ${typeFilter === t
                      ? "bg-positive/15 text-positive border-positive/30"
                      : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
                    {t === "" ? "Бүгд" : t === "income" ? "Орлого" : "Зарлага"}
                  </button>
                ))}
                <div className="relative ml-2 flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Хайх — тайлбар, ангилал, гэрээ..."
                    className="h-8 w-full pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <button onClick={openModal}
                  className="ml-auto h-8 px-3 text-xs rounded-lg border border-positive/30 bg-positive/10 text-positive hover:bg-positive/15 flex items-center gap-1.5 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Гүйлгээ нэмэх
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Уншиж байна...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center">
                  <TableIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Гүйлгээ байхгүй байна</p>
                <button onClick={openModal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-positive text-background text-sm font-medium hover:bg-positive/90">
                  <Plus className="w-4 h-4" /> Шинэ гүйлгээ нэмэх
                </button>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead style={{ width: "90px" }}>Огноо</TableHead>
                      <TableHead>Тайлбар</TableHead>
                      <TableHead style={{ width: "100px" }}>Гэрээ</TableHead>
                      <TableHead style={{ width: "90px" }}>Ангилал</TableHead>
                      <TableHead className="text-right" style={{ width: "130px" }}>Дүн</TableHead>
                      <TableHead style={{ width: "70px" }}>Төрөл</TableHead>
                      <TableHead className="text-right" style={{ width: "60px" }}>Үйлдэл</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(t => (
                      <TableRow key={t._id} className="border-border/50 hover:bg-secondary/30">
                        <TableCell className="text-muted-foreground text-xs">{t.date}</TableCell>
                        <TableCell className="text-sm max-w-0 overflow-hidden">
                          <div className="truncate">{t.description}</div>
                          {t.note && <div className="text-xs text-muted-foreground truncate">{t.note}</div>}
                        </TableCell>
                        <TableCell>
                          {t.contractNumber ? (
                            <button onClick={() => { setContractInput(t.contractNumber ?? ""); setTab("contract"); setTimeout(searchContract, 100); }}
                              className="text-xs text-info hover:underline font-medium">{t.contractNumber}</button>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{t.category}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium stat-number ${t.type === "income" ? "text-positive" : "text-negative"}`}>
                          {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={t.type === "income"
                            ? "bg-positive/15 text-positive hover:bg-positive/15 text-xs"
                            : "bg-negative/15 text-negative hover:bg-negative/15 text-xs"}>
                            {t.type === "income" ? "Орлого" : "Зарлага"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-info"
                              onClick={() => openEditModal(t)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
                                  <AlertDialogDescription>Энэ гүйлгээг устгана.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(t._id!)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Устгах
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
                <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {totalCount} мөр · Орлого: {fmt(totalInc)} · Зарлага: {fmt(totalExp)} · Цэвэр: {fmtSigned(totalInc - totalExp)}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(1)} disabled={page === 1}
                        className="h-7 w-7 rounded-lg border border-border text-xs flex items-center justify-center disabled:opacity-30 hover:bg-secondary/50">«</button>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="h-7 w-7 rounded-lg border border-border text-xs flex items-center justify-center disabled:opacity-30 hover:bg-secondary/50">‹</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce<(number | string)[]>((acc, p, i, arr) => {
                          if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) => p === "..." ? (
                          <span key={`dots-${i}`} className="h-7 px-1 flex items-center text-xs text-muted-foreground">…</span>
                        ) : (
                          <button key={p} onClick={() => setPage(p as number)}
                            className={`h-7 min-w-[28px] px-2 rounded-lg border text-xs font-medium transition-colors ${
                              page === p ? "bg-positive text-background border-positive" : "border-border hover:bg-secondary/50"
                            }`}>{p}</button>
                        ))}
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="h-7 w-7 rounded-lg border border-border text-xs flex items-center justify-center disabled:opacity-30 hover:bg-secondary/50">›</button>
                      <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                        className="h-7 w-7 rounded-lg border border-border text-xs flex items-center justify-center disabled:opacity-30 hover:bg-secondary/50">»</button>
                      <span className="text-xs text-muted-foreground ml-1">{page}/{totalPages} хуудас</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "contract" && (
          <>
            <div className="glass-card px-5 py-4 mb-4">
              <p className="relative text-xs font-medium text-muted-foreground mb-3">Гэрээний дугаар оруулах</p>
              <div className="relative flex gap-2">
                <input
                  value={contractInput}
                  onChange={e => setContractInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchContract()}
                  placeholder="contract numer-2026-001"
                  className="flex-1 h-10 px-4 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring tracking-wide"
                />
                <Button onClick={searchContract} disabled={contractLoading} className="h-10 px-5 bg-positive text-background hover:bg-positive/90">
                  <Search className="w-4 h-4 mr-1.5" />
                  {contractLoading ? "Хайж байна..." : "Хайх"}
                </Button>
                <Button variant="outline" onClick={() => { setContractInput(""); setContractData(null); setContractNotFound(false); }} className="h-10 px-3">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {contractNotFound && (
              <div className="glass-card px-5 py-10 text-center text-muted-foreground text-sm">
                <FileText className="relative w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <span className="relative">"{contractInput}" дугаартай гэрээ олдсонгүй.</span>
              </div>
            )}

            {contractData && (
              <>
                <div className="glass-card px-5 py-4 mb-4">
                  <div className="relative flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-info mb-1">{contractData.contractNumber}</h2>
                      <p className="text-sm text-muted-foreground">
                        {contractData.incomeCount} орлого · {contractData.expenseCount} зарлага · нийт {contractData.transactions.length} гүйлгээ
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleContractExport}>
                      <Download className="w-4 h-4 mr-1.5" />Excel татах
                    </Button>
                  </div>

                  <div className="relative grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-info/10 rounded-xl p-4">
                      <p className="text-xs font-medium text-info mb-2">Нийт орлого</p>
                      <p className="text-2xl font-semibold text-info stat-number">{fmt(contractData.totalIncome)}</p>
                      <p className="text-xs text-info mt-1">{contractData.incomeCount} гүйлгээ</p>
                    </div>
                    <div className="bg-negative/10 rounded-xl p-4">
                      <p className="text-xs font-medium text-negative mb-2">Нийт зарлага</p>
                      <p className="text-2xl font-semibold text-negative stat-number">{fmt(contractData.totalExpense)}</p>
                      <p className="text-xs text-negative mt-1">{contractData.expenseCount} гүйлгээ</p>
                    </div>
                    <div className={`rounded-xl p-4 ${contractData.netProfit >= 0 ? "bg-positive/10" : "bg-negative/10"}`}>
                      <p className={`text-xs font-medium mb-2 ${contractData.netProfit >= 0 ? "text-positive" : "text-negative"}`}>Цэвэр ашиг</p>
                      <p className={`text-2xl font-semibold stat-number ${contractData.netProfit >= 0 ? "text-positive" : "text-negative"}`}>
                        {fmtSigned(contractData.netProfit)}
                      </p>
                      <p className={`text-xs mt-1 ${contractData.netProfit >= 0 ? "text-positive" : "text-negative"}`}>
                        {contractData.netProfit >= 0 ? "Ашигтай" : "Алдагдалтай"} · маржин {contractData.margin}%
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Зарлага / Орлого</span>
                      <span>{contractData.totalIncome > 0 ? Math.round(contractData.totalExpense / contractData.totalIncome * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-negative rounded-full" style={{
                        width: contractData.totalIncome > 0
                          ? Math.min(100, Math.round(contractData.totalExpense / contractData.totalIncome * 100)) + "%"
                          : "0%"
                      }} />
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium flex items-center gap-1.5 text-positive">
                      <TrendingUp className="w-4 h-4" />Орлогын гүйлгээ
                    </h3>
                    <span className="text-sm font-medium text-positive">{fmt(contractData.totalIncome)}</span>
                  </div>
                  <div className="glass-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead style={{ width: "90px" }}>Огноо</TableHead>
                          <TableHead>Тайлбар</TableHead>
                          <TableHead style={{ width: "90px" }}>Ангилал</TableHead>
                          <TableHead className="text-right" style={{ width: "130px" }}>Дүн</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contractData.transactions.filter(t => t.type === "income").map(t => (
                          <TableRow key={t._id} className="border-border/50 hover:bg-secondary/30">
                            <TableCell className="text-muted-foreground text-xs">{t.date}</TableCell>
                            <TableCell className="text-sm blur-number">{t.description}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{t.category}</Badge></TableCell>
                            <TableCell className="text-right font-medium text-positive stat-number">+{fmt(t.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium flex items-center gap-1.5 text-negative">
                      <TrendingDown className="w-4 h-4" />Зарлагын гүйлгээ
                    </h3>
                    <span className="text-sm font-medium text-negative">{fmt(contractData.totalExpense)}</span>
                  </div>
                  <div className="glass-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead style={{ width: "90px" }}>Огноо</TableHead>
                          <TableHead>Тайлбар</TableHead>
                          <TableHead style={{ width: "90px" }}>Ангилал</TableHead>
                          <TableHead className="text-right" style={{ width: "130px" }}>Дүн</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contractData.transactions.filter(t => t.type === "expense").map(t => (
                          <TableRow key={t._id} className="border-border/50 hover:bg-secondary/30">
                            <TableCell className="text-muted-foreground text-xs">{t.date}</TableCell>
                            <TableCell className="text-sm blur-number">{t.description}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{t.category}</Badge></TableCell>
                            <TableCell className="text-right font-medium text-negative stat-number">-{fmt(t.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
