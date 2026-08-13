import { useEffect, useState, useCallback, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "@/lib/expense";
import { fmtDate, toDateInputValue } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
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
import { LogOut, TableIcon, Plus, Pencil, Trash2, ChevronLeft, Receipt, BarChart2, Users, Box, ArrowLeftRight, Download, ShieldCheck, HardHat, Handshake, Package } from "lucide-react";
import { mergeCategories, addCustomCategory } from "@/lib/customCategories";
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

export default function ExpensePage() {
  const navigate = useNavigate();
  const { company, isAdmin } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();

  const statusMap: Record<string, { label: string; cls: string }> = {
    approved: { label: t.expenses.statusApproved, cls: "bg-positive/15 text-positive hover:bg-positive/15" },
    pending: { label: t.expenses.statusPending, cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
    rejected: { label: t.expenses.statusRejected, cls: "bg-negative/15 text-negative hover:bg-negative/15" },
  };

  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const NAV_ITEMS = [
    { path: "/dashboard", label: t.common.navDashboard, icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: t.common.navEmployees, icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: t.common.navAssets, icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: t.common.navExpenses, icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: t.common.navReceivables, icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/workforce", label: t.common.navWorkforce, icon: <HardHat className="w-4 h-4" /> },
    { path: "/partners", label: t.common.navPartners, icon: <Handshake className="w-4 h-4" /> },
    { path: "/products", label: t.common.navProducts, icon: <Package className="w-4 h-4" /> },
    { path: "/transactions", label: t.common.navTransactions, icon: <TableIcon className="w-4 h-4" /> },
    ...(isAdmin ? [{ path: "/admin/users", label: t.common.navAdmin, icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try { setExpenses(await getExpenses()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = typeFilter ? expenses.filter(e => e.type === typeFilter) : expenses;
  const totalApproved = filtered.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const totalPending = filtered.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const officeTotal = expenses.filter(e => e.type === "office" && e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const otherTotal = expenses.filter(e => e.type === "other" && e.status === "approved").reduce((s, e) => s + e.amount, 0);

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
      alert(err.response?.data?.error || t.expenses.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e._id !== id));
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
              <Receipt className="w-5 h-5" /> {t.expenses.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.expenses.pageSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? t.common.exportingLabel : t.common.excelExport}
          </Button>
          <Button onClick={openCreate} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> {t.expenses.addExpense}
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
          <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>{t.expenses.colDate}</TableHead>
                  <TableHead>{t.expenses.colType}</TableHead>
                  <TableHead>{t.expenses.colCategory}</TableHead>
                  <TableHead>{t.expenses.colDescription}</TableHead>
                  <TableHead className="text-right">{t.expenses.colAmount}</TableHead>
                  <TableHead>{t.expenses.colStatus}</TableHead>
                  <TableHead className="text-right">{t.expenses.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exp => (
                  <TableRow key={exp._id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="text-muted-foreground text-sm">{fmtDate(exp.date)}</TableCell>
                    <TableCell>
                      <Badge className={exp.type === "office"
                        ? "bg-info/15 text-info hover:bg-info/15"
                        : "bg-[oklch(0.6_0.18_300)]/15 text-[oklch(0.6_0.18_300)] hover:bg-[oklch(0.6_0.18_300)]/15"}>
                        {exp.type === "office" ? t.expenses.typeOffice : t.expenses.typeOther}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{exp.category}</TableCell>
                    <TableCell className="font-medium">{exp.description}</TableCell>
                    <TableCell className="text-right font-medium text-negative stat-number">{fmt(exp.amount)}</TableCell>
                    <TableCell>
                      <Badge className={statusMap[exp.status].cls}>{statusMap[exp.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
        )}
      </main>

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
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
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
