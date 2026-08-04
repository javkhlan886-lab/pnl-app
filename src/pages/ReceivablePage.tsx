import { useEffect, useState, useCallback, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getReceivables, createReceivable, updateReceivable, deleteReceivable } from "@/lib/receivable";
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
import { LogOut, TableIcon, Plus, Pencil, Trash2, ChevronLeft, ArrowLeftRight, BarChart2, Users, Box, Receipt, Download, ShieldCheck } from "lucide-react";

const EMPTY = {
  type: "receivable" as "receivable" | "loan",
  counterparty: "", unitPrice: 0, quantity: 1, amount: 0, dueDate: "",
  interestRate: 0, status: "current" as "current" | "near" | "overdue" | "paid",
  note: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

export default function ReceivablePage() {
  const navigate = useNavigate();
  const { company, isAdmin } = useAuth();
  const location = useLocation();
  const { t } = useLocale();

  const statusMap: Record<string, { label: string; cls: string }> = {
    current: { label: t.receivables.statusCurrent, cls: "bg-positive/15 text-positive hover:bg-positive/15" },
    near: { label: t.receivables.statusNear, cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
    overdue: { label: t.receivables.statusOverdue, cls: "bg-negative/15 text-negative hover:bg-negative/15" },
    paid: { label: t.receivables.statusPaid, cls: "bg-muted text-muted-foreground hover:bg-muted" },
  };

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | "receivable" | "loan">("");
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
    { path: "/transactions", label: t.common.navTransactions, icon: <TableIcon className="w-4 h-4" /> },
    ...(isAdmin ? [{ path: "/admin/users", label: t.common.navAdmin, icon: <ShieldCheck className="w-4 h-4" /> }] : []),
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getReceivables()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = typeFilter ? items.filter(i => i.type === typeFilter) : items;
  const receivables = items.filter(i => i.type === "receivable" && i.status !== "paid");
  const loans = items.filter(i => i.type === "loan" && i.status !== "paid");
  const overdueItems = items.filter(i => i.status === "overdue");
  const totalReceivable = receivables.reduce((s, i) => s + i.amount, 0);
  const totalLoan = loans.reduce((s, i) => s + i.amount, 0);

  const openCreate = () => {
    setForm({ ...EMPTY }); setEditing(null); setUnitPriceDisplay(""); setQuantityInput(1); setAmountDisplay(""); setOpen(true);
  };
  const openEdit = (item: any) => {
    setForm(item); setEditing(item._id);
    setUnitPriceDisplay(item.unitPrice ? Number(item.unitPrice).toLocaleString("mn-MN") : "");
    setQuantityInput(item.quantity || 1);
    setAmountDisplay(item.amount === 0 ? "" : item.amount.toLocaleString("mn-MN"));
    setOpen(true);
  };

  const handleSave = async () => {
    const quantity = Math.max(1, Number(form.quantity || 1));
    const unitPrice = Number(form.unitPrice || 0);
    const amount = Number(form.amount || unitPrice * quantity);
    const payload = { ...form, unitPrice, quantity, amount };
    if (!payload.counterparty.trim() || payload.amount === 0) return;
    setSaving(true);
    try {
      setForm(payload);
      if (editing) {
        const updated = await updateReceivable(editing, payload);
        setItems(prev => prev.map(i => i._id === editing ? updated : i));
      } else {
        const created = await createReceivable(payload);
        setItems(prev => [created, ...prev]);
      }
      setOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteReceivable(id);
    setItems(prev => prev.filter(i => i._id !== id));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/export/receivables`, {
        headers: { Authorization: `Bearer ${token}` },
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
    } catch { alert(t.dashboard.exportErrorAlert); }
    finally { setExporting(false); }
  };

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
              <ArrowLeftRight className="w-5 h-5" /> {t.receivables.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.receivables.pageSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? t.common.exportingLabel : t.common.excelExport}
          </Button>
          <Button onClick={openCreate} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> {t.receivables.add}
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1.5" /> {t.common.logout}</Button>
          <LanguageSwitcher />
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
                  active ? "nav-pill-active font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}>
                {item.icon}{item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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
          <div className={`glass-card ${totalReceivable - totalLoan >= 0 ? "glass-card-positive" : "glass-card-negative"} px-4 py-3`}>
            <p className="relative text-xs text-muted-foreground mb-1">{t.receivables.statNetPosition}</p>
            <p className={`relative text-xl font-semibold stat-number ${totalReceivable - totalLoan >= 0 ? "text-positive" : "text-negative"}`}>
              {fmt(totalReceivable - totalLoan)}
            </p>
            <p className="relative text-xs text-muted-foreground mt-1">{t.receivables.netPositionSub}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(["", "receivable", "loan"] as const).map(f => (
            <button key={f} onClick={() => startTransition(() => setTypeFilter(f))}
              className={`h-8 px-3 text-xs rounded-lg border ${typeFilter === f
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {f === "" ? t.common.all : f === "receivable" ? t.receivables.typeReceivable : t.receivables.typeLoan}
            </button>
          ))}
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
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>{t.receivables.colCounterparty}</TableHead>
                  <TableHead>{t.receivables.colType}</TableHead>
                  <TableHead className="text-right">{t.receivables.colAmount}</TableHead>
                  <TableHead className="text-right">{t.receivables.colInterestRate}</TableHead>
                  <TableHead>{t.receivables.colDueDate}</TableHead>
                  <TableHead>{t.receivables.colStatus}</TableHead>
                  <TableHead className="text-right">{t.receivables.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item._id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="font-medium blur-number">{item.counterparty}</TableCell>
                    <TableCell>
                      <Badge className={item.type === "receivable"
                        ? "bg-positive/15 text-positive hover:bg-positive/15"
                        : "bg-negative/15 text-negative hover:bg-negative/15"}>
                        {item.type === "receivable" ? t.receivables.typeReceivable : t.receivables.typeLoan}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium stat-number ${item.type === "receivable" ? "text-positive" : "text-negative"}`}>
                      {fmt(item.amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.interestRate > 0 ? `${item.interestRate}%` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.dueDate || "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusMap[item.status].cls}>{statusMap[item.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.receivables.editTitle : t.receivables.newTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
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
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {form.type === "receivable" ? t.receivables.counterpartyReceivable : t.receivables.counterpartyLoan}
                </label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.counterparty} onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
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
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.quantity}</label>
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
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.totalAmount}</label>
                <input readOnly className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right text-muted-foreground"
                  value={amountDisplay} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.interestRate}</label>
                <input type="number" min={0} step={0.1}
                  className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t.receivables.dueDate}</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
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
