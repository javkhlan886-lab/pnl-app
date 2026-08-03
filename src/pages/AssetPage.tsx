import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getAssets, createAsset, updateAsset, disposeAsset, calcDepreciation } from "@/lib/asset";
import { getEmployees } from "@/lib/employee";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
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
import { LogOut, TableIcon, Plus, Pencil, Trash2, ChevronLeft, Box, BarChart2, Users, Receipt, ArrowLeftRight, Download } from "lucide-react";

const CATEGORIES = [
  "Тоног төхөөрөмж", "Тээврийн хэрэгсэл", "Программ хангамж",
  "Тавилга, эд хогшил", "Барилга, байгууламж", "Цахилгаан хэрэгсэл",
  "Нийлмэл хөрөнгө", "Бусад",
];

const EMPTY = {
  name: "", code: "", category: "Тоног төхөөрөмж",
  unitPrice: 0, quantity: 1, price: 0, residualValue: 0, lifespan: 5,
  depMethod: "straight" as "straight" | "declining",
  purchaseDate: new Date().toISOString().split("T")[0],
  supplier: "", assignedTo: "", location: "", note: "", currency: "₮",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

const statusCls: Record<string, string> = {
  active: "bg-positive/15 text-positive hover:bg-positive/15",
  disposed: "bg-muted text-muted-foreground hover:bg-muted",
  maintenance: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15",
};
const statusLabel: Record<string, string> = {
  active: "Идэвхтэй", disposed: "Хасагдсан", maintenance: "Засвар",
};

export default function AssetPage() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const location = useLocation();
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [unitPriceDisplay, setUnitPriceDisplay] = useState("");
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [residualDisplay, setResidualDisplay] = useState("");

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
    try {
      const [a, e] = await Promise.all([getAssets(), getEmployees()]);
      setAssets(a); setEmployees(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = catFilter ? assets.filter(a => a.category === catFilter) : assets;
  const activeAssets = assets.filter(a => a.status === "active");
  const totalValue = activeAssets.reduce((s, a) => s + a.price, 0);
  const totalAccumDep = activeAssets.reduce((s, a) => {
    if (!a.purchaseDate) return s;
    return s + calcDepreciation(a.price, a.residualValue, a.lifespan, a.depMethod, a.purchaseDate).accumulated;
  }, 0);
  const totalCurrentValue = totalValue - totalAccumDep;

  const openCreate = () => {
    setForm({ ...EMPTY }); setEditing(null);
    setUnitPriceDisplay(""); setQuantityInput(1); setResidualDisplay(""); setOpen(true);
  };
  const openEdit = (a: any) => {
    setForm(a); setEditing(a._id);
    setUnitPriceDisplay(a.unitPrice ? Number(a.unitPrice).toLocaleString("mn-MN") : "");
    setQuantityInput(a.quantity || 1);
    setResidualDisplay(a.residualValue === 0 ? "" : a.residualValue.toLocaleString("mn-MN"));
    setOpen(true);
  };

  const handleSave = async () => {
    const quantity = Math.max(1, Number(form.quantity || 1));
    const unitPrice = Number(form.unitPrice || 0);
    const price = Number(form.price || unitPrice * quantity);
    const payload = { ...form, unitPrice, quantity, price };
    if (!payload.name.trim()) return;
    setSaving(true);
    try {
      setForm(payload);
      if (editing) {
        const updated = await updateAsset(editing, payload);
        setAssets(prev => prev.map(a => a._id === editing ? updated : a));
      } else {
        const code = "AST-" + payload.category.slice(0, 2).toUpperCase() + "-" + Math.floor(Math.random() * 9000 + 1000);
        const created = await createAsset({ ...payload, code });
        setAssets(prev => [created, ...prev]);
      }
      setOpen(false);
    } finally { setSaving(false); }
  };

  const handleDispose = async (id: string) => {
    await disposeAsset(id);
    setAssets(prev => prev.map(a => a._id === id ? { ...a, status: "disposed" } : a));
  };

  const dep = form.price > 0 && form.purchaseDate
    ? calcDepreciation(form.price, form.residualValue, form.lifespan, form.depMethod, form.purchaseDate)
    : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/export/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export алдаа");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets.xlsx";
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
              <Box className="w-5 h-5" /> Хөрөнгийн бүртгэл
            </h1>
            <p className="text-xs text-muted-foreground">Компанийн хөрөнгө, элэгдлийн тооцоо</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Боловсруулж байна..." : "Excel татах"}
          </Button>
          <Button onClick={openCreate} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> Хөрөнгө нэмэх
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
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Нийт хөрөнгө</p>
            <p className="relative text-xl font-semibold stat-number">{assets.length}</p>
            <p className="relative text-xs text-muted-foreground mt-1">{activeAssets.length} идэвхтэй</p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Анхны үнэ</p>
            <p className="relative text-xl font-semibold text-info stat-number">{fmt(totalValue)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">нийт</p>
          </div>
          <div className="glass-card glass-card-negative px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Хуримтлагдсан элэгдэл</p>
            <p className="relative text-xl font-semibold text-negative stat-number">{fmt(totalAccumDep)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">нийт</p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">Дансны үнэ</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{fmt(totalCurrentValue)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">өнөөдрийн байдлаар</p>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {["", ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`h-8 px-3 text-xs rounded-lg border ${catFilter === c
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {c || "Бүгд"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Уншиж байна...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">Хөрөнгө бүртгэгдээгүй байна</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" />
                {exporting ? "Боловсруулж байна..." : "Excel татах"}
              </Button>
              <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">Шинэ хөрөнгө нэмэх</Button>
            </div>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Нэр</TableHead>
                  <TableHead>Ангилал</TableHead>
                  <TableHead className="text-right">Нэгж үнэ</TableHead>
                  <TableHead className="text-right">Тоо</TableHead>
                  <TableHead className="text-right">Нийт үнэ</TableHead>
                  <TableHead className="text-right">Сарын элэгдэл</TableHead>
                  <TableHead className="text-right">Дансны үнэ</TableHead>
                  <TableHead>Элэгдэл %</TableHead>
                  <TableHead>Хариуцагч</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const d = a.purchaseDate
                    ? calcDepreciation(a.price, a.residualValue, a.lifespan, a.depMethod, a.purchaseDate)
                    : null;
                  return (
                    <TableRow key={a._id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.code}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.category}</TableCell>
                      <TableCell className="text-right stat-number">{fmt(a.unitPrice || 0)}</TableCell>
                      <TableCell className="text-right stat-number">{a.quantity || 1}</TableCell>
                      <TableCell className="text-right stat-number">{fmt(a.price)}</TableCell>
                      <TableCell className="text-right text-negative stat-number">{d ? fmt(d.monthly) : "—"}</TableCell>
                      <TableCell className="text-right text-positive font-medium stat-number">{d ? fmt(d.currentValue) : "—"}</TableCell>
                      <TableCell>
                        {d ? (
                          <div className="flex items-center gap-2 min-w-20">
                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-info rounded-full" style={{ width: `${d.depreciatedPct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{d.depreciatedPct}%</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.assignedTo || "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusCls[a.status]}>{statusLabel[a.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
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
                                <AlertDialogTitle>Хасах уу?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {a.name}-г хасагдсан болгоно. Бүртгэлд үлдэнэ.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDispose(a._id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Хасах
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Хөрөнгө засах" : "Хөрөнгө нэмэх"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Нэр *</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="MacBook Pro 16&quot;" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ангилал</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Худалдаж авсан огноо</label>
                <input type="date" className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
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
                      const total = num * qty;
                      return { ...f, unitPrice: num, price: total, quantity: qty };
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
                      const total = unit * q;
                      return { ...f, quantity: q, price: total };
                    });
                  }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Нийт үнэ</label>
                <input readOnly className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right text-muted-foreground"
                  value={form.price ? form.price.toLocaleString("mn-MN") : ""} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Үлдэгдэл үнэ</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                  inputMode="numeric" value={residualDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setResidualDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, residualValue: num }));
                  }} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ашиглалтын хугацаа (жил)</label>
                <input type="number" min={1} max={50}
                  className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.lifespan} onChange={e => setForm(f => ({ ...f, lifespan: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Элэгдлийн арга</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.depMethod} onChange={e => setForm(f => ({ ...f, depMethod: e.target.value as any }))}>
                  <option value="straight">Шулуун шугаман</option>
                  <option value="declining">Буурах элэгдлийн</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Хариуцагч ажилтан</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                  <option value="">— Сонгоогүй —</option>
                  {employees.map(e => <option key={e._id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Байрлал</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Оффис 301" />
              </div>
            </div>
            {dep && (
              <div className="bg-secondary/50 rounded-lg px-4 py-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-2">Элэгдлийн тооцоо</p>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Сарын элэгдэл</span>
                  <span className="text-negative blur-number">{fmt(dep.monthly)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Жилийн элэгдэл</span>
                  <span className="text-negative blur-number">{fmt(dep.yearly)}</span>
                </div>
                <div className="flex justify-between py-1 font-medium">
                  <span>Өнөөдрийн дансны үнэ</span>
                  <span className="text-positive blur-number">{fmt(dep.currentValue)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-info rounded-full" style={{ width: `${dep.depreciatedPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{dep.depreciatedPct}% элэгдсэн</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Цуцлах</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="bg-positive text-background hover:bg-positive/90">
              {saving ? "Хадгалж байна..." : editing ? "Хадгалах" : "Нэмэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
