import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPNL, updatePNL } from "@/lib/pnl";
import { PNLRecord, Row } from "@/types";
import { fmt } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, ArrowLeft, CheckCircle2 } from "lucide-react";

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
}

const RowSection = ({ type, label, rows, currency, total, onUpdate, onAdd, onDelete }: RowSectionProps) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</h3>
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        Нэмэх
      </Button>
    </div>
    <div className="rounded-lg border overflow-hidden">
      <div className="grid grid-cols-12 gap-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
        <div className="col-span-4">Нэр</div>
        <div className="col-span-3">Тайлбар</div>
        <div className="col-span-2 text-right">Нэгж үнэ ({currency})</div>
        <div className="col-span-1 text-right">Тоо</div>
        <div className="col-span-1 text-right">Нийт ({currency})</div>
        <div className="col-span-1"></div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-0 px-3 py-1.5 border-b last:border-0 hover:bg-muted/20 items-center">
          <div className="col-span-4 pr-2">
            <input
              value={r.name}
              placeholder="Нэр..."
              onChange={(e) => onUpdate(i, "name", e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "13px", color: "inherit" }}
            />
          </div>
          <div className="col-span-3 pr-2">
            <input
              value={r.note}
              placeholder="Тайлбар..."
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
        <div className="col-span-8 text-muted-foreground">Нийт {label.toLowerCase()}</div>
        <div className={`col-span-3 text-right ${type === "incomeRows" ? "text-green-600" : "text-red-500"}`}>
          {fmt(total, currency)}
        </div>
        <div className="col-span-1"></div>
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
      } else {
        const created = await createPNL(payload);
        navigate(`/dashboard/${created._id}`, { replace: true });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Хадгалахад алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Үндсэн мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Байгууллага</Label>
              <Input value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder="Байгууллагын нэр" />
            </div>
            <div className="space-y-1.5">
              <Label>Тайлант үе</Label>
              <Input value={data.period} onChange={(e) => setData({ ...data, period: e.target.value })} placeholder="2025 оны 1-р улирал" />
            </div>
            <div className="space-y-1.5">
              <Label>Огноо</Label>
              <Input type="date" value={data.date || ""} onChange={(e) => setData({ ...data, date: e.target.value })} />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Гэрээний мэдээлэл</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="flex items-center gap-1.5">
                  Гэрээний дугаар
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-normal">Шинэ</span>
                </Label>
                <Input
                  value={data.contractNumber || ""}
                  onChange={(e) => setData({ ...data, contractNumber: e.target.value.toUpperCase() })}
                  placeholder="GCR-2024-001"
                  className="font-mono tracking-wide"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Гэрээний ангилал</Label>
                <Select value={data.contractCategory || ""} onValueChange={(v) => setData({ ...data, contractCategory: v })}>
                  <SelectTrigger><SelectValue placeholder="— Сонгох —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="construction">Барилга / Угсралт</SelectItem>
                    <SelectItem value="consulting">Зөвлөх үйлчилгээ</SelectItem>
                    <SelectItem value="supply">Нийлүүлэлт</SelectItem>
                    <SelectItem value="transport">Тээвэр / Логистик</SelectItem>
                    <SelectItem value="other">Бусад</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Статус</Label>
                <Select value={data.status || "active"} onValueChange={(v) => setData({ ...data, status: v as "active" | "pending" | "closed" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">✦ Идэвхтэй</SelectItem>
                    <SelectItem value="pending">◎ Хүлээгдэж буй</SelectItem>
                    <SelectItem value="closed">✕ Хаагдсан</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Валют</Label>
                <Select value={data.currency} onValueChange={(v) => setData({ ...data, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="₮">MNT — ₮</SelectItem>
                    <SelectItem value="$">USD — $</SelectItem>
                    <SelectItem value="¥">CNY — ¥</SelectItem>
                    <SelectItem value="€">EUR — €</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <RowSection
            type="incomeRows" label="Орлого"
            rows={data.incomeRows} currency={data.currency} total={totalIncome}
            onUpdate={(i, f, v) => updateRow("incomeRows", i, f, v)}
            onAdd={() => addRow("incomeRows")}
            onDelete={(i) => delRow("incomeRows", i)}
          />
          <Separator />
          <RowSection
            type="expenseRows" label="Зарлага"
            rows={data.expenseRows} currency={data.currency} total={totalExpense}
            onUpdate={(i, f, v) => updateRow("expenseRows", i, f, v)}
            onAdd={() => addRow("expenseRows")}
            onDelete={(i) => delRow("expenseRows", i)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Нийт орлого", val: fmt(totalIncome, data.currency), color: "text-green-600" },
              { label: "Нийт зарлага", val: fmt(totalExpense, data.currency), color: "text-red-500" },
              { label: "Цэвэр ашиг/алдагдал", val: fmt(net, data.currency), color: net >= 0 ? "text-green-600" : "text-red-500" },
              { label: "Ашгийн маржин", val: `${margin}%`, color: Number(margin) >= 0 ? "text-green-600" : "text-red-500" },
            ].map((c) => (
              <div key={c.label} className="bg-muted/40 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-xl font-semibold ${c.color}`}>{c.val}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? "Хадгалж байна..." : "Хадгалах"}
        </Button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Амжилттай хадгаллаа
          </div>
        )}
        <Button variant="ghost" className="ml-auto" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Буцах
        </Button>
      </div>
    </div>
  );
}
