import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getWorkforce, createWorkforce, updateWorkforce, deleteWorkforce } from "@/lib/workforce";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useLocale } from "@/hooks/useLocale";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { getRecent, addRecent } from "@/lib/recentValues";
import { setAiPageContext } from "@/lib/aiPageContext";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";
import { LogOut, Plus, Pencil, Trash2, ChevronLeft, BarChart2, Users, Box, Receipt, ArrowLeftRight, TableIcon, ShieldCheck, HardHat, Handshake, Package } from "lucide-react";

interface WorkforceRecord {
  _id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  skills: string;
  rate: number;
  status: "active" | "inactive";
  note: string;
}

const EMPTY: WorkforceRecord = {
  name: "", address: "", phone: "", email: "", skills: "", rate: 0, status: "active", note: "",
};

const fmt = (n: number) => "₮" + Math.round(n).toLocaleString("mn-MN");

export default function WorkforcePage() {
  const navigate = useNavigate();
  const { company, isAdmin, user } = useAuth();
  const location = useLocation();
  const { t } = useLocale();
  const layoutMode = useLayoutMode();

  const statusLabel: Record<string, string> = {
    active: t.workforce.statusActive, inactive: t.workforce.statusInactive,
  };

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

  const [items, setItems] = useState<WorkforceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WorkforceRecord>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateDisplay, setRateDisplay] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getWorkforce()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = items.filter(i => i.status === "active").length;

  useEffect(() => {
    const lines = [
      `Нийт бүртгэлтэй ажиллах хүч: ${items.length} (${activeCount} идэвхтэй)`,
    ];
    setAiPageContext({ title: t.workforce.pageTitle, lines });
    return () => setAiPageContext(null);
  }, [items.length, activeCount, t]);

  const openCreate = () => {
    setForm(EMPTY); setEditing(null); setRateDisplay(""); setOpen(true);
  };
  const openEdit = (item: any) => {
    setForm(item); setEditing(item._id);
    setRateDisplay(item.rate ? Number(item.rate).toLocaleString("mn-MN") : "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      addRecent("workforce", "name", form.name);
      addRecent("workforce", "skills", form.skills);
      addRecent("workforce", "address", form.address);
      addRecent("workforce", "phone", form.phone);
      addRecent("workforce", "email", form.email);
      addRecent("workforce", "note", form.note);
      if (editing) {
        const updated = await updateWorkforce(editing, form);
        setItems(prev => prev.map(i => i._id === editing ? updated : i));
      } else {
        const created = await createWorkforce(form);
        setItems(prev => [created, ...prev]);
      }
      setOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.error || t.workforce.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteWorkforce(id);
    setItems(prev => prev.filter(i => i._id !== id));
  };

  const headerActions = (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <Button onClick={openCreate} size="sm"
        className="bg-positive text-background hover:bg-positive/90 shadow-[0_0_16px_color-mix(in_oklch,oklch(var(--positive))_35%,transparent)]">
        <Plus className="w-4 h-4 mr-1.5" /> {t.workforce.add}
      </Button>
      <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1.5" /> {t.common.logout}</Button>
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
              <HardHat className="w-5 h-5" /> {t.workforce.pageTitle}
            </h1>
            <p className="text-xs text-muted-foreground">{t.workforce.pageSubtitle}</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <CompanyLogo name={company?.name} className="cursor-pointer" onClick={() => navigate("/dashboard")} />
            <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium flex items-center gap-2">
                <HardHat className="w-5 h-5" /> {t.workforce.pageTitle}
              </h1>
              <p className="text-xs text-muted-foreground">{t.workforce.pageSubtitle}</p>
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
        <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
          <div className="glass-card px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.workforce.statTotal}</p>
            <p className="relative text-xl font-semibold stat-number">{items.length}</p>
          </div>
          <div className="glass-card glass-card-positive px-4 py-3">
            <p className="relative text-xs text-muted-foreground mb-1">{t.workforce.statActive}</p>
            <p className="relative text-xl font-semibold text-positive stat-number">{activeCount}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">{t.workforce.noRecords}</p>
            <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">{t.workforce.addFirstRecord}</Button>
          </div>
        ) : (
          <div className="glass-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>{t.workforce.colName}</TableHead>
                  <TableHead>{t.workforce.colPhone}</TableHead>
                  <TableHead>{t.workforce.colSkills}</TableHead>
                  <TableHead className="text-right">{t.workforce.colRate}</TableHead>
                  <TableHead>{t.workforce.colStatus}</TableHead>
                  <TableHead className="text-right">{t.workforce.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item._id} className="border-border/50 hover:bg-secondary/30">
                    <TableCell className="font-medium blur-number">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{item.skills || "—"}</TableCell>
                    <TableCell className="text-right stat-number">{fmt(item.rate)}</TableCell>
                    <TableCell>
                      <Badge className={item.status === "active"
                        ? "bg-positive/15 text-positive hover:bg-positive/15"
                        : "bg-muted text-muted-foreground hover:bg-muted"}>
                        {statusLabel[item.status]}
                      </Badge>
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
                              <AlertDialogDescription>{t.workforce.deleteConfirmDesc}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item._id!)}
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
      </div>
    </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.workforce.editTitle : t.workforce.newTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">{t.workforce.name}</Label>
              <Combobox value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} options={getRecent("workforce", "name")} placeholder={t.workforce.namePlaceholder} className="h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">{t.workforce.address}</Label>
              <Combobox value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} options={getRecent("workforce", "address")} placeholder={t.workforce.addressPlaceholder} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{t.workforce.phone}</Label>
                <Combobox value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} options={getRecent("workforce", "phone")} className="h-9 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{t.workforce.email}</Label>
                <Combobox value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} options={getRecent("workforce", "email")} className="h-9 text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">{t.workforce.skills}</Label>
              <Combobox value={form.skills} onChange={v => setForm(f => ({ ...f, skills: v }))} options={getRecent("workforce", "skills")} placeholder={t.workforce.skillsPlaceholder} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{t.workforce.rate}</Label>
                <Input
                  value={rateDisplay}
                  inputMode="numeric"
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const num = Number(raw) || 0;
                    setRateDisplay(num === 0 ? "" : num.toLocaleString("mn-MN"));
                    setForm(f => ({ ...f, rate: num }));
                  }}
                  placeholder="0" className="h-9 text-sm text-right" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">{t.workforce.status}</Label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="active">{t.workforce.statusActive}</option>
                  <option value="inactive">{t.workforce.statusInactive}</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">{t.workforce.note}</Label>
              <Combobox value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} options={getRecent("workforce", "note")} className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="bg-positive text-background hover:bg-positive/90">
              {saving ? t.common.saving : editing ? t.common.save : t.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
