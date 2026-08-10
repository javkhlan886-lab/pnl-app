import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPNL, updatePNL } from "@/lib/pnl";
import { PNLRecord, Row } from "@/types";
import { fmt, toDateInputValue } from "@/lib/utils";
import { toMnt, defaultRate, getSavedRate, saveRate } from "@/lib/exchangeRates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useLocale, format } from "@/hooks/useLocale";
import type { Dictionary } from "@/lib/i18n/dictionary-type";

const defaultIncome: Row[] = [
  { name: "Гэрээт ажлын орлого", note: "Угсралт, суурилуулалт", unitPrice: 0, quantity: 1, amount: 0 },
  { name: "Тоног төхөөрөмж борлуулалт", note: "", unitPrice: 0, quantity: 1, amount: 0 },
  { name: "Үйлчилгээний төлбөр", note: "", unitPrice: 0, quantity: 1, amount: 0 },
];
const defaultExpense: Row[] = [
  { name: "Цалин хөлс", note: "Нийт ажилчид", unitPrice: 0, quantity: 1, amount: 0 },
  { name: "Материал, тоног төхөөрөмж", note: "", unitPrice: 0, quantity: 1, amount: 0 },
  { name: "Түрээс", note: "Оффис", unitPrice: 0, quantity: 1, amount: 0 },
  { name: "Тээвэр, шатахуун", note: "", unitPrice: 0, quantity: 1, amount: 0 },
  { name: "Татвар, хураамж", note: "НӨАТ, НДШ", unitPrice: 0, quantity: 1, amount: 0 },
  { name: "Бусад зардал", note: "", unitPrice: 0, quantity: 1, amount: 0 },
];

const formatWithCommas = (num: number): string => {
  if (num === 0) return "";
  return num.toLocaleString("mn-MN");
};

const AmountInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [display, setDisplay] = useState(value === 0 ? "" : formatWithCommas(value));
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplay(value === 0 ? "" : formatWithCommas(value));
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => e.currentTarget.select(), 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const raw = input.value.replace(/[^0-9]/g, "");
    const num = Number(raw) || 0;
    const formatted = num === 0 ? "" : formatWithCommas(num);

    const prevFormatted = display;
    const caretPos = input.selectionStart ?? 0;
    const commasBefore = (prevFormatted.slice(0, caretPos).match(/,/g) || []).length;
    const newCommasBefore = (formatted.slice(0, caretPos).match(/,/g) || []).length;
    const newCaret = caretPos + (newCommasBefore - commasBefore);

    setDisplay(formatted);
    onChange(num);

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCaret, newCaret);
      }
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={display}
      placeholder="0"
      onChange={handleChange}
      onFocus={handleFocus}
      style={{
        textAlign: "right",
        width: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        fontSize: "13px",
        fontWeight: 500,
        color: "inherit",
      }}
    />
  );
};

interface RowSectionProps {
  type: "incomeRows" | "expenseRows";
  label: string;
  rows: Row[];
  currency: string;
  total: number;
  onUpdate: (i: number, field: keyof Row | "unitPrice" | "quantity", val: string | number) => void;
  onAdd: () => void;
  onDelete: (i: number) => void;
  t: Dictionary;
}

const RowSection = ({ type, label, rows, currency, total, onUpdate, onAdd, onDelete, t }: RowSectionProps) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</h3>
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        {t.common.add}
      </Button>
    </div>
    <div className="rounded-lg border overflow-x-auto">
      <div className="min-w-[640px]">
      <div className="grid grid-cols-12 gap-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
        <div className="col-span-4">{t.pnlForm.colName}</div>
        <div className="col-span-3">{t.pnlForm.colNote}</div>
        <div className="col-span-2 text-right">{format(t.pnlForm.colUnitPrice, { currency })}</div>
        <div className="col-span-1 text-right">{t.pnlForm.colQuantity}</div>
        <div className="col-span-1 text-right">{format(t.pnlForm.colTotal, { currency })}</div>
        <div className="col-span-1"></div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-0 px-3 py-1.5 border-b last:border-0 hover:bg-muted/20 items-center">
          <div className="col-span-4 pr-2">
            <input
              value={r.name}
              placeholder={t.pnlForm.namePlaceholder}
              onChange={(e) => onUpdate(i, "name", e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "13px", color: "inherit" }}
            />
          </div>
          <div className="col-span-3 pr-2">
            <input
              value={r.note}
              placeholder={t.pnlForm.notePlaceholder}
              onChange={(e) => onUpdate(i, "note", e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "13px", color: "inherit", opacity: 0.6 }}
            />
          </div>
          <div className="col-span-2">
            <AmountInput value={Number(r.unitPrice || 0)} onChange={(v) => onUpdate(i, "unitPrice", v)} />
          </div>
          <div className="col-span-1">
            <input type="number" min={1} value={r.quantity || 1} onChange={(e) => onUpdate(i, "quantity", Math.max(1, Number(e.target.value) || 1))}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "13px", textAlign: "right" }} />
          </div>
          <div className="col-span-1">
            <AmountInput value={Number(r.amount || 0)} onChange={(v) => onUpdate(i, "amount", v)} />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(i)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-12 gap-0 px-3 py-2 bg-muted/40 text-sm font-medium">
        <div className="col-span-8 text-muted-foreground">{format(t.pnlForm.totalOf, { label: label.toLowerCase() })}</div>
        <div className={`col-span-3 text-right ${type === "incomeRows" ? "text-green-600" : "text-red-500"}`}>
          {fmt(total, currency)}
        </div>
        <div className="col-span-1"></div>
      </div>
      </div>
    </div>
  </div>
);

interface Props {
  initial?: PNLRecord;
  id?: string;
}

export default function PNLForm({ initial, id }: Props) {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [data, setData] = useState<PNLRecord>(
    initial || {
      company: "",
      period: "",
      currency: "₮",
      incomeRows: defaultIncome,
      expenseRows: defaultExpense,
      contractNumber: "",
      contractCategory: "",
      contractStatus: "active",
      status: "active",
      date: new Date().toISOString().split("T")[0],
    }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);

  // "Тайлант үе" нь эхлэх/дуусах огноогоор бөглөгддөг болсон тул хуучин
  // чөлөөт текст `period` талбарыг өөрчлөхгүйгээр (backend/schema-д хамаагүй)
  // энэ хоёр огнооноос автоматаар угсарна.
  const periodParts = (data.period || "").split(" — ");
  const [periodStart, setPeriodStart] = useState(periodParts[0] || "");
  const [periodEnd, setPeriodEnd] = useState(periodParts[1] || "");

  useEffect(() => {
    const next = periodStart && periodEnd ? `${periodStart} — ${periodEnd}` : periodStart || periodEnd || "";
    setData((prev) => (prev.period === next ? prev : { ...prev, period: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, periodEnd]);

  const totalIncome = data.incomeRows.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = data.expenseRows.reduce((s, r) => s + Number(r.amount), 0);
  const net = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : "0.0";

  const updateRow = useCallback((type: "incomeRows" | "expenseRows", i: number, field: keyof Row | "unitPrice" | "quantity", val: string | number) => {
    setData((prev) => {
      const rows = [...prev[type]];
      const row = { ...rows[i] } as any;
      if (field === "unitPrice") {
        row.unitPrice = Number(val) || 0;
        row.quantity = Number(row.quantity || 1);
        row.amount = Number(row.unitPrice || 0) * Number(row.quantity || 1);
      } else if (field === "quantity") {
        row.quantity = Number(val) || 1;
        row.unitPrice = Number(row.unitPrice || 0);
        row.amount = Number(row.unitPrice || 0) * Number(row.quantity || 1);
      } else if (field === "amount") {
        row.amount = Number(val) || 0;
        // when amount is set directly, keep unitPrice as-is; if quantity available, derive unitPrice
        if (row.quantity && row.quantity > 0) {
          row.unitPrice = Math.round((Number(row.amount) || 0) / Number(row.quantity));
        }
      } else {
        row[field as string] = val;
      }
      rows[i] = row;
      return { ...prev, [type]: rows };
    });
  }, []);

  const addRow = useCallback((type: "incomeRows" | "expenseRows") => {
    setData((prev) => ({ ...prev, [type]: [...prev[type], { name: "", note: "", unitPrice: 0, quantity: 1, amount: 0 }] }));
  }, []);

  const delRow = useCallback((type: "incomeRows" | "expenseRows", i: number) => {
    setData((prev) => ({ ...prev, [type]: prev[type].filter((_, idx) => idx !== i) }));
  }, []);

  const save = async () => {
    const normalizedRows = (rows: Row[]) => rows.map((row) => {
      const quantity = Math.max(1, Number(row.quantity || 1));
      const unitPrice = Number(row.unitPrice || 0);
      const amount = Number(row.amount || unitPrice * quantity);
      return {
        ...row,
        unitPrice,
        quantity,
        amount,
      };
    });

    const payload = {
      ...data,
      incomeRows: normalizedRows(data.incomeRows),
      expenseRows: normalizedRows(data.expenseRows),
    };

    setSaving(true);
    try {
      setData(payload);
      if (id) {
        await updatePNL(id, payload);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        setSaving(false);
      } else {
        await createPNL(payload);
        // Шинэ тайланг хадгалмагц засварлах хуудас руу шилжихийн оронд
        // шууд dashboard руу буцаана — dashboard дахин mount хийгдэж,
        // жагсаалтаа шинээр татдаг тул шинэ тайлан нэн даруй харагдана.
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || t.pnlForm.saveError);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{t.pnlForm.basicInfo}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>{t.pnlForm.company}</Label>
              <Input value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder={t.pnlForm.companyPlaceholder} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.pnlForm.periodStart}</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.pnlForm.periodEnd}</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.pnlForm.date}</Label>
              <Input type="date" value={toDateInputValue(data.date)} onChange={(e) => setData({ ...data, date: e.target.value })} />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">{t.pnlForm.contractInfo}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="flex items-center gap-1.5">
                  {t.pnlForm.contractNumber}
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-normal">{t.pnlForm.newBadge}</span>
                </Label>
                <Input
                  value={data.contractNumber || ""}
                  onChange={(e) => setData({ ...data, contractNumber: e.target.value.toUpperCase() })}
                  placeholder="GCR-2024-001"
                  className="font-mono tracking-wide"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.pnlForm.contractCategory}</Label>
                <Select value={data.contractCategory || ""} onValueChange={(v) => setData({ ...data, contractCategory: v })}>
                  <SelectTrigger><SelectValue placeholder={t.pnlForm.selectPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="construction">{t.pnlForm.categoryConstruction}</SelectItem>
                    <SelectItem value="consulting">{t.pnlForm.categoryConsulting}</SelectItem>
                    <SelectItem value="supply">{t.pnlForm.categorySupply}</SelectItem>
                    <SelectItem value="transport">{t.pnlForm.categoryTransport}</SelectItem>
                    <SelectItem value="other">{t.pnlForm.categoryOther}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.pnlForm.status}</Label>
                <Select value={data.status || "active"} onValueChange={(v) => setData({ ...data, status: v as "active" | "pending" | "closed" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t.pnlForm.statusActive}</SelectItem>
                    <SelectItem value="pending">{t.pnlForm.statusPending}</SelectItem>
                    <SelectItem value="closed">{t.pnlForm.statusClosed}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground leading-snug">{t.pnlForm.statusHelp}</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{t.pnlForm.currency}</Label>
                <Select
                  value={data.currency}
                  onValueChange={(v) =>
                    setData((prev) => ({
                      ...prev,
                      currency: v,
                      exchangeRate: v === "₮" ? undefined : (prev.exchangeRate ?? getSavedRate(v) ?? defaultRate(v)),
                    }))
                  }>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="₮">MNT — ₮</SelectItem>
                    <SelectItem value="$">USD — $</SelectItem>
                    <SelectItem value="¥">CNY — ¥</SelectItem>
                    <SelectItem value="€">EUR — €</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {data.currency !== "₮" && (
                <div className="space-y-1.5">
                  <Label>{format(t.pnlForm.exchangeRateLabel, { currency: data.currency })}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={0} step="0.01"
                      value={data.exchangeRate ?? ""}
                      onChange={(e) => {
                        setRateSaved(false);
                        setData({ ...data, exchangeRate: Number(e.target.value) || undefined });
                      }}
                      placeholder={String(defaultRate(data.currency))}
                    />
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={!data.exchangeRate}
                      onClick={() => {
                        if (!data.exchangeRate) return;
                        saveRate(data.currency, data.exchangeRate);
                        setRateSaved(true);
                        setTimeout(() => setRateSaved(false), 2000);
                      }}
                      title={t.pnlForm.saveRateHint}>
                      {rateSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <RowSection
            type="incomeRows" label={t.pnlForm.income}
            rows={data.incomeRows} currency={data.currency} total={totalIncome}
            onUpdate={(i, f, v) => updateRow("incomeRows", i, f, v)}
            onAdd={() => addRow("incomeRows")}
            onDelete={(i) => delRow("incomeRows", i)}
            t={t}
          />
          <Separator />
          <RowSection
            type="expenseRows" label={t.pnlForm.expense}
            rows={data.expenseRows} currency={data.currency} total={totalExpense}
            onUpdate={(i, f, v) => updateRow("expenseRows", i, f, v)}
            onAdd={() => addRow("expenseRows")}
            onDelete={(i) => delRow("expenseRows", i)}
            t={t}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t.pnlForm.summaryIncome, val: fmt(totalIncome, data.currency), mnt: toMnt(totalIncome, data.currency, data.exchangeRate), color: "text-green-600" },
              { label: t.pnlForm.summaryExpense, val: fmt(totalExpense, data.currency), mnt: toMnt(totalExpense, data.currency, data.exchangeRate), color: "text-red-500" },
              { label: t.pnlForm.summaryNet, val: fmt(net, data.currency), mnt: toMnt(net, data.currency, data.exchangeRate), color: net >= 0 ? "text-green-600" : "text-red-500" },
              { label: t.pnlForm.summaryMargin, val: `${margin}%`, mnt: null, color: Number(margin) >= 0 ? "text-green-600" : "text-red-500" },
            ].map((c) => (
              <div key={c.label} className="bg-muted/40 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-xl font-semibold ${c.color}`}>{c.val}</p>
                {data.currency !== "₮" && c.mnt !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(t.pnlForm.mntEquivalent, { amount: Math.round(c.mnt).toLocaleString("mn-MN") })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? t.common.saving : t.common.save}
        </Button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            {t.pnlForm.savedMessage}
          </div>
        )}
        <Button variant="ghost" className="ml-auto" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {t.pnlForm.back}
        </Button>
      </div>
    </div>
  );
}
