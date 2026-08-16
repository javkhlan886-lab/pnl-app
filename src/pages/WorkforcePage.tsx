import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { getWorkforce, createWorkforce, updateWorkforce, deleteWorkforce } from "@/lib/workforce";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { getRecent, addRecent } from "@/lib/recentValues";
import { toast } from "@/lib/toast";
import { setAiPageContext } from "@/lib/aiPageContext";
import { useLayoutMode } from "@/lib/layoutMode";
import { Sidebar } from "@/components/Sidebar";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronDown, BarChart2, Users, Box, Receipt, ArrowLeftRight, TableIcon, ShieldCheck, HardHat, Handshake, Package, Search, Download } from "lucide-react";

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

const PAGE_SIZE = 20;

type SortKey = "index" | "name" | "phone" | "skills" | "rate" | "status";

// Баганын толгой дээр дарахад ижил утгатай мөрүүд зэрэгцэн эрэмбэлэгдэж харагдана.
const sortValue = (item: WorkforceRecord, idx: number, key: SortKey): string | number => {
  switch (key) {
    case "index": return idx;
    case "name": return (item.name || "").toLowerCase();
    case "phone": return (item.phone || "").toLowerCase();
    case "skills": return (item.skills || "").toLowerCase();
    case "rate": return item.rate;
    case "status": return item.status;
  }
};

const statusCls: Record<string, string> = {
  active: "bg-positive/15 text-positive hover:bg-positive/15",
  inactive: "bg-muted text-muted-foreground hover:bg-muted",
};

export default function WorkforcePage() {
  const navigate = useNavigate();
  const { company, isAdmin, user } = useAuth();
  const location = useLocation();
  const { t, locale } = useLocale();
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
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WorkforceRecord>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateDisplay, setRateDisplay] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setItems(await getWorkforce()); }
    catch { setError(t.workforce.loadError); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const activeCount = items.filter(i => i.status === "active").length;

  useEffect(() => {
    const lines = [
      `Нийт бүртгэлтэй ажиллах хүч: ${items.length} (${activeCount} идэвхтэй)`,
    ];
    setAiPageContext({ title: t.workforce.pageTitle, lines });
    return () => setAiPageContext(null);
  }, [items.length, activeCount, t]);

  const filtered = items.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!i.name.toLowerCase().includes(q) && !(i.phone || "").toLowerCase().includes(q) && !(i.skills || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  let sortedFiltered = filtered;
  if (sortKey) {
    const withIdx = filtered.map((item, i) => ({ item, v: sortValue(item, i, sortKey) }));
    withIdx.sort((a, b) => {
      const cmp = typeof a.v === "string" && typeof b.v === "string"
        ? a.v.localeCompare(b.v)
        : (a.v as number) - (b.v as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    sortedFiltered = withIdx.map(x => x.item);
  }

  const pageCount = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const pagedFiltered = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [statusFilter, search, sortKey, sortDir]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => { setSelected(new Set()); }, [statusFilter, search]);

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
      toast.error(err.response?.data?.error || t.workforce.saveError);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteWorkforce(id);
    setItems(prev => prev.filter(i => i._id !== id));
  };

  // Хүснэгтэн дэх мөр бүрийн төлвийг цонх нээхгүйгээр шууд солих.
  const handleInlineStatusChange = async (item: WorkforceRecord, next: WorkforceRecord["status"]) => {
    setOpenStatusId(null);
    try {
      const updated = await updateWorkforce(item._id!, { ...item, status: next });
      setItems(prev => prev.map(x => x._id === item._id ? updated : x));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.workforce.saveError);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => deleteWorkforce(id)));
      setItems(prev => prev.filter(i => !selected.has(i._id!)));
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err.response?.data?.error || t.workforce.saveError);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/workforce/export?locale=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t.dashboard.exportErrorAlert);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "workforce.xlsx";
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
        <Plus className="w-4 h-4 mr-1.5" /> {t.workforce.add}
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
        {error && (
          <div className="mb-4 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
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

        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-positive/60" />
            <p className="text-xs font-medium text-positive">
              {format(t.workforce.selectedCount, { count: String(selected.size) })}
            </p>
            <div className="ml-auto flex items-center gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-xs text-destructive hover:text-destructive/80">
                    {t.workforce.bulkDeleteButton}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.common.deleteConfirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {format(t.workforce.bulkDeleteConfirmDesc, { count: String(selected.size) })}
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
                {t.workforce.deselect}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.workforce.searchPlaceholder}
              className="h-8 w-56 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {(["active", "inactive"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(f => f === s ? "" : s)}
              className={`h-8 px-3 text-xs rounded-lg border ${statusFilter === s
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-background text-muted-foreground border-border hover:bg-secondary/50"}`}>
              {s === "active" ? t.workforce.filterActive : t.workforce.filterInactive}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">{t.common.loading}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <p className="text-muted-foreground mb-1">{t.workforce.noRecords}</p>
            <Button onClick={openCreate} className="bg-positive text-background hover:bg-positive/90">{t.workforce.addFirstRecord}</Button>
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
                  <SortableHead sortKeyName="index" label={t.workforce.colIndex} className="w-6" />
                  <SortableHead sortKeyName="name" label={t.workforce.colName} />
                  <SortableHead sortKeyName="phone" label={t.workforce.colPhone} />
                  <SortableHead sortKeyName="skills" label={t.workforce.colSkills} />
                  <SortableHead sortKeyName="rate" label={t.workforce.colRate} align="right" />
                  <SortableHead sortKeyName="status" label={t.workforce.colStatus} />
                  <TableHead className="text-right px-1.5 whitespace-nowrap text-[11px] uppercase tracking-wide font-semibold text-muted-foreground/80">{t.workforce.colActions}</TableHead>
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
                    <TableCell className="px-1.5 font-medium blur-number">{item.name}</TableCell>
                    <TableCell className="px-1.5 text-muted-foreground text-sm">{item.phone || "—"}</TableCell>
                    <TableCell className="px-1.5 text-muted-foreground text-sm max-w-xs truncate">{item.skills || "—"}</TableCell>
                    <TableCell className="px-1.5 text-right stat-number">{fmt(item.rate)}</TableCell>
                    <TableCell className="px-1.5">
                      <div className="relative inline-block">
                        <button type="button"
                          onClick={() => setOpenStatusId(openStatusId === item._id ? null : item._id!)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusCls[item.status]}`}>
                          {statusLabel[item.status]}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                        {openStatusId === item._id && (
                          <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 py-1 min-w-32">
                            {(["active", "inactive"] as const).map(s => (
                              <button key={s} type="button" onClick={() => handleInlineStatusChange(item, s)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/50 text-left">
                                <Badge className={statusCls[s]}>{statusLabel[s]}</Badge>
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
