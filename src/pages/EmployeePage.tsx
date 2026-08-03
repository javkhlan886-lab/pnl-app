import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logoUrl from "@/public/logo.png";
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "@/lib/employee";
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
import { LogOut, TableIcon, Plus, Pencil, Trash2, Users, ChevronLeft, BarChart2, Box, Receipt, ArrowLeftRight, Download } from "lucide-react";

interface Employee {
  _id?: string;
  name: string;
  position: string;
  type: "engineer" | "staff";
  baseSalary: number;
  ndRate: number;
  ndshtRate: number;
  status: "active" | "leave" | "inactive";
  startDate: string;
}

const EMPTY: Employee = {
  name: "", position: "", type: "staff",
  baseSalary: 0, ndRate: 10, ndshtRate: 2,
  status: "active", startDate: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

const statusLabel: Record<string, { label: string; cls: string }> = {
  active: { label: "Идэвхтэй", cls: "bg-positive/15 text-positive hover:bg-positive/15" },
  leave: { label: "Чөлөөтэй", cls: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/15" },
  inactive: { label: "Гарсан", cls: "bg-muted text-muted-foreground hover:bg-muted" },
};

function fmtInput(v: number) {
  return v === 0 ? "" : v.toLocaleString("mn-MN");
}

const NAV_ITEMS = [
  { path: "/dashboard", label: "P&L Тайлан", icon: <BarChart2 className="w-4 h-4" /> },
  { path: "/employees", label: "Ажилчид & Цалин", icon: <Users className="w-4 h-4" /> },
  { path: "/assets", label: "Хөрөнгө", icon: <Box className="w-4 h-4" /> },
  { path: "/expenses", label: "Зардал", icon: <Receipt className="w-4 h-4" /> },
  { path: "/receivables", label: "Зээл & Авлага", icon: <ArrowLeftRight className="w-4 h-4" /> },
  { path: "/transactions", label: "Гүйлгээний дэвтэр", icon: <TableIcon className="w-4 h-4" /> },
];

export default function EmployeePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Employee>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [salaryDisplay, setSalaryDisplay] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setEmployees(await getEmployees()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalSalary = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary, 0);
  const totalND = employees.filter(e => e.status === "active")
    .reduce((s, e) => s + e.baseSalary * e.ndRate / 100, 0);
  const totalCost = totalSalary + totalND;
  const engineerCount = employees.filter(e => e.type === "engineer").length;
  const staffCount = employees.filter(e => e.type === "staff").length;

  const openCreate = () => {
    setForm(EMPTY); setEditing(null);
    setSalaryDisplay(""); setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setForm(emp); setEditing(emp._id!);
    setSalaryDisplay(fmtInput(emp.baseSalary)); setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateEmployee(editing, form);
        setEmployees(prev => prev.map(e => e._id === editing ? updated : e));
      } else {
        const created = await createEmployee(form);
        setEmployees(prev => [created, ...prev]);
      }
      setOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e._id !== id));
  };

  const nd = form.baseSalary * form.ndRate / 100;
  const ndsht = form.baseSalary * form.ndshtRate / 100;
  const totalFormCost = form.baseSalary + nd + ndsht;

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/export/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export алдаа");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "employees.xlsx";
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
          <img src={logoUrl} className="w-[114px] h-[114px] object-contain cursor-pointer" onClick={() => navigate("/dashboard")} />
          <button onClick={() => navigate("/dashboard")}
            className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-medium flex items-center gap-2">
              <Users className="w-5 h-5" /> Ажилчид & Цалин
            </h1>
            <p className="text-xs text-muted-foreground">Ажилчдын бүртгэл, НД тооцоо</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? "Боловсруулж байна..." : "Excel татах"}
          </Button>
          <Button onClick={openCreate} size="sm"
            className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
            <Plus className="w-4 h-4 mr-1.5" /> Ажилтан нэмэх
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1.5" /> Гарах
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Module navigation */}
      <nav className="border-b border-border/50 px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <button key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 my-2 text-xs rounded-full transition-colors whitespace-nowrap ${
                location.pathname === item.path
                  ? "nav-pill-active font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card glass-card-positive px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">Нийт ажилчид</p>
            <p className="relative stat-number text-2xl font-bold">{employees.length}</p>
            <p className="relative text-xs text-muted-foreground mt-1">
              {engineerCount} engineer, {staffCount} ажилтан
            </p>
          </div>
          <div className="glass-card glass-card-negative px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">Нийт цалин</p>
            <p className="relative stat-number text-2xl font-bold">{fmt(totalSalary)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">Сарын</p>
          </div>
          <div className="glass-card glass-card-negative px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">НД хувь (10%)</p>
            <p className="relative stat-number text-2xl font-bold">{fmt(totalND)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">Жил дутгад хувь</p>
          </div>
          <div className="glass-card glass-card-negative px-5 py-4">
            <p className="relative text-sm text-muted-foreground mb-1">Нийт зардал</p>
            <p className="relative stat-number text-2xl font-bold">{fmt(totalCost)}</p>
            <p className="relative text-xs text-muted-foreground mt-1">Цалин + НД</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">Уншиж байна...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">Ажилтан бүртгэгдээгүй байна</p>
            <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">
              Шинэ ажилтан нэмэх
            </Button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Нэр</TableHead>
                  <TableHead>Албан тушаал</TableHead>
                  <TableHead>Ангилал</TableHead>
                  <TableHead className="text-right">Үндсэн цалин</TableHead>
                  <TableHead className="text-right">НД (10%)</TableHead>
                  <TableHead className="text-right">НДШТ (2%)</TableHead>
                  <TableHead className="text-right">Нийт зардал</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => {
                  const nd = emp.baseSalary * emp.ndRate / 100;
                  const ndsht = emp.baseSalary * emp.ndshtRate / 100;
                  const total = emp.baseSalary + nd + ndsht;
                  const st = statusLabel[emp.status];
                  return (
                    <TableRow key={emp._id} className="border-border/50 hover:bg-secondary/30">
                      <TableCell className="font-medium blur-number">{emp.name}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.position || "—"}</TableCell>
                      <TableCell>
                        <Badge className={emp.type === "engineer"
                          ? "bg-info/15 text-info hover:bg-info/15"
                          : "bg-muted text-muted-foreground hover:bg-muted"}>
                          {emp.type === "engineer" ? "Engineer" : "Ажилтан"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right stat-number">{fmt(emp.baseSalary)}</TableCell>
                      <TableCell className="text-right text-negative stat-number">{fmt(nd)}</TableCell>
                      <TableCell className="text-right text-negative stat-number">{fmt(ndsht)}</TableCell>
                      <TableCell className="text-right font-medium text-negative stat-number">{fmt(total)}</TableCell>
                      <TableCell>
                        <Badge className={st.cls}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"
                                className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Устгах уу?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {emp.name}-г устгавал буцааж сэргээх боломжгүй.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(emp._id!)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Устгах
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Ажилтан засах" : "Ажилтан нэмэх"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Нэр *</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Б. Батбаяр" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Албан тушаал</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="Senior Engineer" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ангилал</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="engineer">Engineer</option>
                  <option value="staff">Ажилтан</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Статус</label>
                <select className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">Идэвхтэй</option>
                  <option value="leave">Чөлөөтэй</option>
                  <option value="inactive">Гарсан</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Үндсэн цалин *</label>
              <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                inputMode="numeric"
                value={salaryDisplay}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  const num = Number(raw) || 0;
                  setSalaryDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                  setForm(f => ({ ...f, baseSalary: num }));
                }}
                placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">НД хувь (%)</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  type="number" min={0} max={100}
                  value={form.ndRate}
                  onChange={e => setForm(f => ({ ...f, ndRate: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">НДШТ хувь (%)</label>
                <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  type="number" min={0} max={100}
                  value={form.ndshtRate}
                  onChange={e => setForm(f => ({ ...f, ndshtRate: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ажилд орсон огноо</label>
              <input className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            {form.baseSalary > 0 && (
              <div className="bg-secondary/50 rounded-lg px-4 py-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Үндсэн цалин</span>
                  <span className="blur-number">{fmt(form.baseSalary)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">НД ({form.ndRate}%)</span>
                  <span className="text-negative blur-number">{fmt(nd)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">НДШТ ({form.ndshtRate}%)</span>
                  <span className="text-negative blur-number">{fmt(ndsht)}</span>
                </div>
                <div className="flex justify-between py-1 font-medium border-t border-border mt-1 pt-2">
                  <span>Нийт зардал</span>
                  <span className="text-negative blur-number">{fmt(totalFormCost)}</span>
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
