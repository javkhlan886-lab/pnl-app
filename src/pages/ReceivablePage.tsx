import { useEffect, useState, useCallback, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getReceivables, createReceivable, updateReceivable, deleteReceivable } from "@/lib/receivable";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
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
import { LogOut, TableIcon, Plus, Pencil, Trash2, ChevronLeft, ArrowLeftRight, BarChart2, Users, Box, Receipt, Download } from "lucide-react";

const EMPTY = {
  type: "receivable" as "receivable" | "loan",
  counterparty: "", unitPrice: 0, quantity: 1, amount: 0, dueDate: "",
  interestRate: 0, status: "current" as "current" | "near" | "overdue" | "paid",
  note: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

const statusMap: Record<string, { label: string; cls: string }> = {
  current: { label: "Хугацаандаа", cls: "bg-positive/15 text-positive hover:bg-positive/15" },
  near: { label: "Ойртсон", cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
  overdue: { label: "Хэтэрсэн", cls: "bg-negative/15 text-negative hover:bg-negative/15" },
  paid: { label: "Төлөгдсөн", cls: "bg-muted text-muted-foreground hover:bg-muted" },
};

export default function ReceivablePage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const location = useLocation();
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
    { path: "/dashboard", label: "P&L Тайлан", icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: "Ажилчид & Цалин", icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: "Хөрөнгө", icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: "Зардал", icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: "Зээл & Авлага", icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/transactions", label: "Гүйлгээний дэвтэр", icon: <TableIcon className="w-4 h-4" /> },
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
      if (!res.ok) throw new Error("Export алдаа");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "receivables.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { alert("Export алдаа гарлаа"); }
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
              <ArrowLeftRight className="w-5 h-5" /> Зээл & Авлага
            </h1>
            <p className="text-xs text-muted-foreground">Авлага болон зээлийн бүртгэл</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Боловсруулж байна..." : "Excel татах"}
          </Button>
          <Button onClick={openCreate} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> Нэмэх
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1.5" /> Гарах</Button>
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
            <p className="relative text-xs text-muted-foreground mb-1">Нийт авлага</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{fmt(totalReceivable)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{receivables.length} харилцагч</p>
          </div>
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Нийт зээл</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{fmt(totalLoan)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{loans.length} зээл</p>
          </div>
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Хугацаа хэтэрсэн</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{overdueItems.length}</p>
            <p className="relative text-xs text-muted-foreground mt-1 blur-number">
              {fmt(overdueItems.reduce((s, i) => s + i.amount, 0))}
            </p>
          </div>
          <div className={`glass-card ${totalReceivable - totalLoan >= 0 ? "glass-card-positive" : "glass-card-negative"} px-4 py-3`}>
            <p className="relative text-xs text-muted-foreground mb-1">Цэвэр байрлал</p>
            <p className={`relative text-xl font-semibold stat-number ${totalReceivable - totalLoan >= 0 ? "text-positive" : "text-negative"}`}>
              {fmt(totalReceivable - totalLoan)}
            </p>
            <p className="relative text-xs text-muted-foreground mt-1">Авлага - Зээл</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(["", "receivable", "loan"] as const).map(t => (
            <button key={t} onClick={() => startTransition(() => setTypeFilter(t))}
              className={`h-8 px-3 text-xs rounded-lg border ${typeFilter === t
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {t === "" ? "Бүгд" : t === "receivable" ? "Авлага" : "Зээл"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Уншиж байна...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">Бүртгэл байхгүй байна</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" />
                {exporting ? "Боловсруулж байна..." : "Excel татах"}
              </Button>
              <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">Шинэ бүртгэл нэмэх</Button>
            </div>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Харилцагч</TableHead>
                  <TableHead>Төрөл</TableHead>
                  <TableHead className="text-right">Дүн</TableHead>
                  <TableHead className="text-right">Хүү (%)</TableHead>
                  <TableHead>Хугацаа</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
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
                        {item.type === "receivable" ? "Авлага" : "Зээл"}
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
                              <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
                              <AlertDialogDescription>Энэ бүртгэлийг устгана.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item._id)}
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
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Засах" : "Шинэ бүртгэл"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Төрөл</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="receivable">Авлага</option>
                  <option value="loan">Зээл</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Статус</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="current">Хугацаандаа</option>
                  <option value="near">Ойртсон</option>
                  <option value="overdue">Хэтэрсэн</option>
                  <option value="paid">Төлөгдсөн</option>
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {form.type === "receivable" ? "Харилцагч байгууллага *" : "Банк / Зээлдэгч *"}
                </label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.counterparty} onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                  placeholder={form.type === "receivable" ? "Голомт ХХК" : "Голомт банк"} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Нэгж үнэ</label>
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
                <label className="text-xs font-medium text-muted-foreground">Тоо ширхэг</label>
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
                <label className="text-xs font-medium text-muted-foreground">Нийт дүн</label>
                <input readOnly className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right text-muted-foreground"
                  value={amountDisplay} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Хүү (%)</label>
                <input type="number" min={0} step={0.1}
                  className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Хугацаа дуусах огноо</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Цуцлах</Button>
            <Button onClick={handleSave} disabled={saving || !form.counterparty.trim() || form.amount === 0}
              className="bg-positive text-background hover:bg-positive/90">
              {saving ? "Хадгалж байна..." : editing ? "Хадгалах" : "Нэмэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
