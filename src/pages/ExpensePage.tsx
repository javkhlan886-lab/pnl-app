import { useEffect, useState, useCallback, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getExpenses, createExpense, updateExpense, deleteExpense } from "@/lib/expense";
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
import { LogOut, TableIcon, Plus, Pencil, Trash2, ChevronLeft, Receipt, BarChart2, Users, Box, ArrowLeftRight, Download } from "lucide-react";

const OFFICE_CATS = ["Оффис", "Тоног төхөөрөмж", "Цахилгаан, интернет", "Тээвэр, шатахуун", "Татвар, хураамж", "Бусад"];
const OTHER_CATS = ["Маркетинг", "Аялал, томилолт", "Сургалт", "Хуулийн зардал", "Эрүүл мэндийн зардал", "Бусад"];

const EMPTY = {
  type: "office" as "office" | "other",
  category: "Оффис", description: "",
  unitPrice: 0, quantity: 1, amount: 0, date: new Date().toISOString().split("T")[0],
  status: "pending" as "approved" | "pending" | "rejected", note: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

const statusMap: Record<string, { label: string; cls: string }> = {
  approved: { label: "Батлагдсан", cls: "bg-positive/15 text-positive hover:bg-positive/15" },
  pending: { label: "Хүлээгдэж буй", cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
  rejected: { label: "Татгалзсан", cls: "bg-negative/15 text-negative hover:bg-negative/15" },
};

export default function ExpensePage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const location = useLocation();
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
    { path: "/dashboard", label: "P&L Тайлан", icon: <BarChart2 className="w-4 h-4" /> },
    { path: "/employees", label: "Ажилчид & Цалин", icon: <Users className="w-4 h-4" /> },
    { path: "/assets", label: "Хөрөнгө", icon: <Box className="w-4 h-4" /> },
    { path: "/expenses", label: "Зардал", icon: <Receipt className="w-4 h-4" /> },
    { path: "/receivables", label: "Зээл & Авлага", icon: <ArrowLeftRight className="w-4 h-4" /> },
    { path: "/transactions", label: "Гүйлгээний дэвтэр", icon: <TableIcon className="w-4 h-4" /> },
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
    setForm(exp); setEditing(exp._id);
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
      setForm(payload);
      if (editing) {
        const updated = await updateExpense(editing, payload);
        setExpenses(prev => prev.map(e => e._id === editing ? updated : e));
      } else {
        const created = await createExpense(payload);
        setExpenses(prev => [created, ...prev]);
      }
      setOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e._id !== id));
  };

  const cats = form.type === "office" ? OFFICE_CATS : OTHER_CATS;

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/export/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export алдаа");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "expenses.xlsx";
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
              <Receipt className="w-5 h-5" /> Зардлын бүртгэл
            </h1>
            <p className="text-xs text-muted-foreground">Оффис болон бусад зардал</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Боловсруулж байна..." : "Excel татах"}
          </Button>
          <Button onClick={openCreate} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> Зардал нэмэх
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1.5" /> Гарах</Button>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Батлагдсан нийт</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{fmt(totalApproved)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{filtered.filter(e => e.status === "approved").length} зардал</p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Хүлээгдэж буй</p>
            <p className="relative text-xl font-semibold text-warn stat-number">{fmt(totalPending)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{filtered.filter(e => e.status === "pending").length} зардал</p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Оффис зардал</p>
            <p className="relative text-xl font-semibold stat-number">{fmt(officeTotal)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">Батлагдсан</p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Бусад зардал</p>
            <p className="relative text-xl font-semibold stat-number">{fmt(otherTotal)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">Батлагдсан</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(["", "office", "other"] as const).map(t => (
            <button key={t} onClick={() => startTransition(() => setTypeFilter(t))}
              className={`h-8 px-3 text-xs rounded-lg border ${typeFilter === t
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {t === "" ? "Бүгд" : t === "office" ? "Оффис" : "Бусад"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Уншиж байна...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">Зардал бүртгэгдээгүй байна</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" />
                {exporting ? "Боловсруулж байна..." : "Excel татах"}
              </Button>
              <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">Шинэ зардал нэмэх</Button>
            </div>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Огноо</TableHead>
                  <TableHead>Төрөл</TableHead>
                  <TableHead>Ангилал</TableHead>
                  <TableHead>Тайлбар</TableHead>
                  <TableHead className="text-right">Дүн</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exp => (
                  <TableRow key={exp._id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="text-muted-foreground text-sm">{exp.date}</TableCell>
                    <TableCell>
                      <Badge className={exp.type === "office"
                        ? "bg-info/15 text-info hover:bg-info/15"
                        : "bg-[oklch(0.6_0.18_300)]/15 text-[oklch(0.6_0.18_300)] hover:bg-[oklch(0.6_0.18_300)]/15"}>
                        {exp.type === "office" ? "Оффис" : "Бусад"}
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
                              <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
                              <AlertDialogDescription>Энэ зардлыг устгана.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(exp._id)}
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
            <DialogTitle>{editing ? "Зардал засах" : "Зардал нэмэх"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Төрөл</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any, category: e.target.value === "office" ? OFFICE_CATS[0] : OTHER_CATS[0] }))}>
                  <option value="office">Оффис</option>
                  <option value="other">Бусад</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ангилал</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Тайлбар *</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Зардлын тайлбар" />
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
                <label className="text-xs font-medium text-muted-foreground">Огноо</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Статус</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="pending">Хүлээгдэж буй</option>
                  <option value="approved">Батлагдсан</option>
                  <option value="rejected">Татгалзсан</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Цуцлах</Button>
            <Button onClick={handleSave} disabled={saving || !form.description.trim() || form.amount === 0}
              className="bg-positive text-background hover:bg-positive/90">
              {saving ? "Хадгалж байна..." : editing ? "Хадгалах" : "Нэмэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
