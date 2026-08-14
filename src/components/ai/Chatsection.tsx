import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Square, ChevronDown, Brain, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getFabPosition, saveFabPosition, type FabPosition } from "@/lib/chatFabPosition";
import { getPNLList } from "@/lib/pnl";
import { getCompanyUsers } from "@/lib/admin";
import { getTransactions } from "@/lib/transaction";
import { getExpenses } from "@/lib/expense";
import { getAssets } from "@/lib/asset";
import { getReceivables } from "@/lib/receivable";
import { getEmployees } from "@/lib/employee";
import { getProducts } from "@/lib/product";
import { useAiPageContext } from "@/lib/aiPageContext";
import { useLocale, format } from "@/hooks/useLocale";
import { PNLRecord, Transaction } from "@/types";
import api from "@/lib/axios";
import {
  streamChat,
  buildSystemInstruction,
  geminiConfigured,
  GEMINI_MODEL,
  resolveLevel,
  AdminContext,
  TxTotals,
  ChatTurn,
} from "@/lib/gemini";

interface Message {
  id: number;
  role: "user" | "model";
  text: string;
  /** Модель тунгааж байх үеийн хураангуй — зөвхөн model мессеж дээр */
  thought?: string;
  error?: boolean;
}

// Модель markdown-аар **bold** бичих тул хамгийн бага хэмжээний форматлалт.
function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function ChatSection() {
  const { user, company, loading: authLoading } = useAuth();
  const { t, locale } = useLocale();
  // Эрх нь тодорхойгүй байвал хамгийн хязгаарлагдмал түвшинг (4) авна.
  const level = resolveLevel(user);
  const SUGGESTIONS = t.chat.suggestions;
  const SCOPE_LABEL = t.chat.scope;

  const [open, setOpen] = useState(false);
  const [fabPos, setFabPos] = useState<FabPosition | null>(() => getFabPosition());
  const fabRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [openThoughtId, setOpenThoughtId] = useState<number | null>(null);

  // Компанийн дата — панелийг нэг удаа онгойлгоход л татна.
  // Бүх endpoint нь backend дээр эрхээр шүүгддэг тул энд ирсэн дата өөрөө
  // тухайн хэрэглэгчийн хармаар хүрээ болно.
  const [context, setContext] = useState<{
    summary: any;
    records: PNLRecord[];
    admin: AdminContext | null;
    txTotals: TxTotals | null;
    transactions: Transaction[];
    expenses: any[];
    assets: any[];
    receivables: any[];
    employees: any[];
    products: any[];
  } | null>(null);

  // Хэрэглэгчийн одоо харж байгаа дэлгэцийн тоо (ж: Гүйлгээний дэвтрийн
  // шүүлтүүрийн дараах "Цэвэр дүн"). Хуудас солиход шинэчлэгдэнэ.
  const pageContext = useAiPageContext();

  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Эрх ачаалагдаж дуустал хүлээнэ — эс бөгөөс Level 1 хэрэглэгчийн
    // admin контекст татагдахгүй үлдэх эсвэл түвшин буруу тодорхойлогдоно.
    if (!open || context || authLoading) return;

    Promise.all([
      api.get("/summary").then((r) => r.data).catch(() => null),
      getPNLList().catch(() => [] as PNLRecord[]),
      // limit=1 — мөр татахгүй, зөвхөн бүх гүйлгээний нэгдсэн дүнг авна.
      getTransactions({ limit: 1 })
        .then((r): TxTotals => ({ total: r.total, ...r.summary }))
        .catch(() => null),
      // Зөвхөн Level 1 (company_admin) — компанийн хэрэглэгчдийн жагсаалт.
      // Saas Back-ийн audit log нь platform-level (зөвхөн super_admin), тул
      // энд хоосон logs дамжуулна — buildSystemInstruction энэ хэсгийг
      // хоосон бол алгасдаг.
      level === 1 && company
        ? getCompanyUsers(company.id)
            .then((users): AdminContext => ({
              users: users.map((u) => ({
                email: u.email,
                name: u.name,
                role: u.role,
                level: resolveLevel(u),
                status: u.status,
              })),
              logs: [],
            }))
            .catch(() => null)
        : Promise.resolve(null),
      // Дэлгэрэнгүй, мөр-мөрөөр задалж харах боломжтой бодит бичлэгүүд —
      // зөвхөн нэгдсэн дүн бус, "хамгийн их зарцуулсан ажил юу байсан бэ" гэх
      // мэт нарийвчилсан асуултад хариулах чадвар өгнө.
      getTransactions({ limit: 100 }).then((r) => r.transactions as Transaction[]).catch(() => []),
      getExpenses().catch(() => []),
      getAssets().catch(() => []),
      getReceivables().catch(() => []),
      getEmployees().catch(() => []),
      getProducts().catch(() => []),
    ]).then(([summary, records, txTotals, admin, transactions, expenses, assets, receivables, employees, products]) =>
      setContext({ summary, records, txTotals, admin, transactions, expenses, assets, receivables, employees, products })
    );
  }, [open, context, authLoading, level, company]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Component unmount болоход хагас дуусаагүй stream-ийг зогсооно.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Дэлгэцийн хэмжээ өөрчлөгдөхөд (ж: тавтай эргүүлэх, цонх багасгах) товч
  // дэлгэцээс гадуур гарахгүй байхаар байрлалыг хамгаалж хязгаарлана.
  useEffect(() => {
    if (!fabPos) return;
    const onResize = () => {
      const el = fabRef.current;
      const w = el?.offsetWidth ?? 160;
      const h = el?.offsetHeight ?? 48;
      const maxX = Math.max(8, window.innerWidth - w - 8);
      const maxY = Math.max(8, window.innerHeight - h - 8);
      setFabPos((prev) => {
        if (!prev) return prev;
        const next = { x: Math.min(Math.max(8, prev.x), maxX), y: Math.min(Math.max(8, prev.y), maxY) };
        if (next.x !== prev.x || next.y !== prev.y) saveFabPosition(next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fabPos]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const clear = () => {
    stop();
    setMessages([]);
    setOpenThoughtId(null);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    // authLoading үед эрх тодорхойгүй тул илгээхгүй — буруу түвшнээр
    // системийн заавар бүрдэхээс сэргийлнэ.
    if (!text || streaming || authLoading) return;

    const userMsg: Message = { id: nextId.current++, role: "user", text };
    const replyId = nextId.current++;

    // Түүхийг өмнөх мессежүүд + шинэ асуултаас бүрдүүлнэ (хоосон хариултыг оруулахгүй).
    const history: ChatTurn[] = [
      ...messages.filter((m) => !m.error && m.text).map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text },
    ];

    setMessages((prev) => [...prev, userMsg, { id: replyId, role: "model", text: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const patch = (fn: (m: Message) => Message) =>
      setMessages((prev) => prev.map((m) => (m.id === replyId ? fn(m) : m)));

    try {
      await streamChat(
        history,
        buildSystemInstruction({
          level,
          summary: context?.summary ?? null,
          records: context?.records ?? [],
          userName: user?.name,
          admin: level === 1 ? context?.admin ?? null : null,
          txTotals: context?.txTotals ?? null,
          transactions: context?.transactions ?? [],
          expenses: context?.expenses ?? [],
          assets: context?.assets ?? [],
          receivables: context?.receivables ?? [],
          employees: context?.employees ?? [],
          products: context?.products ?? [],
          pageContext,
          locale,
        }),
        {
          onThought: (chunk) => patch((m) => ({ ...m, thought: (m.thought || "") + chunk })),
          onText: (chunk) => patch((m) => ({ ...m, text: m.text + chunk })),
        },
        controller.signal
      );

      // Хариулт хоосон ирвэл хэрэглэгчид тодорхой хэлнэ.
      patch((m) =>
        m.text || controller.signal.aborted
          ? m
          : { ...m, text: t.chat.emptyReplyMsg, error: true }
      );
    } catch (err: any) {
      const msg = err?.message || t.chat.genericErrorMsg;
      patch((m) => ({ ...m, text: m.text || msg, error: !m.text }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  };

  if (!open) {
    const clampPos = (x: number, y: number) => {
      const el = fabRef.current;
      const w = el?.offsetWidth ?? 160;
      const h = el?.offsetHeight ?? 48;
      const maxX = Math.max(8, window.innerWidth - w - 8);
      const maxY = Math.max(8, window.innerHeight - h - 8);
      return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      const el = fabRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, moved: false };
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      justDraggedRef.current = true;
      setFabPos(clampPos(d.origX + dx, d.origY + dy));
    };

    const onPointerUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (d?.moved) setFabPos((prev) => { if (prev) saveFabPosition(prev); return prev; });
    };

    return (
      <button
        ref={fabRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (justDraggedRef.current) { justDraggedRef.current = false; return; }
          setOpen(true);
        }}
        title={t.chat.headerTitle}
        style={{ touchAction: "none", ...(fabPos ? { left: fabPos.x, top: fabPos.y, right: "auto", bottom: "auto" } : {}) }}
        className={`fixed z-40 px-4 py-3 rounded-full flex items-center gap-2 text-sm font-medium select-none cursor-grab active:cursor-grabbing
                   bg-positive text-background shadow-[0_0_24px_color-mix(in_oklch,oklch(var(--positive))_40%,transparent)]
                   hover:bg-positive/90 transition-colors ${fabPos ? "" : "bottom-6 right-6"}`}
      >
        <Sparkles className="w-4 h-4" />
        {t.chat.fabLabel}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[min(26rem,calc(100vw-3rem))] h-[min(38rem,calc(100vh-6rem))]
                    flex flex-col glass-card overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card/60">
        <span className="icon-badge-positive w-8 h-8 shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight flex items-center gap-1.5">
            {t.chat.headerTitle}
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-info/15 text-info shrink-0">
              {format(t.chat.levelBadge, { level: String(level) })}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground truncate" title={GEMINI_MODEL}>
            {SCOPE_LABEL[level]}
            {pageContext ? ` · ${pageContext.title}` : ""}
            {context ? "" : t.chat.loadingSuffix}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} title={t.chat.clearTooltip}
            className="text-muted-foreground hover:text-destructive p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => setOpen(false)} title={t.chat.closeTooltip}
          className="text-muted-foreground hover:text-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!geminiConfigured && (
          <div className="flex gap-2 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90">
              <span className="font-medium">VITE_GEMINI_API_KEY</span> {t.chat.geminiWarningNotSet}
              <code className="mx-1">.env.local</code> {t.chat.geminiWarningInstructions}
            </p>
          </div>
        )}

        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {(() => {
                const [before, after] = t.chat.emptyStateIntro.split("{scope}");
                return <>{before}<span className="text-foreground">{SCOPE_LABEL[level].toLowerCase()}</span>{after}</>;
              })()}
            </p>
            <div className="space-y-1.5">
              {/* Одоогийн дэлгэцэд тохирсон санал — эхэнд онцолж үзүүлнэ */}
              {pageContext && (
                <button
                  onClick={() => send(format(t.chat.pageContextSendMsg, { title: pageContext.title }))}
                  disabled={!geminiConfigured || authLoading}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-info/30 bg-info/10
                             text-info hover:bg-info/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {format(t.chat.pageContextButtonLabel, { title: pageContext.title })}
                </button>
              )}
              {SUGGESTIONS[level].map((s) => (
                <button key={s} onClick={() => send(s)} disabled={!geminiConfigured || authLoading}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/50 bg-card/40
                             text-muted-foreground hover:text-foreground hover:bg-secondary/50
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] bg-positive/15 text-foreground rounded-2xl rounded-br-sm px-3.5 py-2 text-sm whitespace-pre-wrap">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="space-y-1.5">
              {m.thought && (
                <div className="rounded-lg border border-border/50 bg-secondary/30 overflow-hidden">
                  <button
                    onClick={() => setOpenThoughtId(openThoughtId === m.id ? null : m.id)}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Brain className="w-3 h-3" />
                    {streaming && !m.text ? t.chat.thinkingLabel : t.chat.thoughtLabel}
                    <ChevronDown
                      className={`w-3 h-3 ml-auto transition-transform ${openThoughtId === m.id ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openThoughtId === m.id && (
                    <p className="px-2.5 pb-2 text-[11px] text-muted-foreground whitespace-pre-wrap border-t border-border/50 pt-2">
                      {m.thought}
                    </p>
                  )}
                </div>
              )}
              {m.text ? (
                <div className={`max-w-[92%] text-sm whitespace-pre-wrap leading-relaxed ${m.error ? "text-destructive" : ""}`}>
                  {renderText(m.text)}
                </div>
              ) : (
                !m.thought && <p className="text-xs text-muted-foreground">{t.chat.typingLabel}</p>
              )}
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border/50 p-3 bg-card/60">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={
              !geminiConfigured
                ? t.chat.placeholderNoKey
                : authLoading
                  ? t.chat.placeholderAuthLoading
                  : t.chat.placeholderReady
            }
            disabled={!geminiConfigured || authLoading}
            className="flex-1 max-h-28 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1
                       focus-visible:ring-ring disabled:opacity-50"
          />
          {streaming ? (
            <Button size="icon" variant="outline" onClick={stop} title={t.chat.stopTooltip}>
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={() => send(input)}
              disabled={!input.trim() || !geminiConfigured || authLoading}
              className="bg-positive text-background hover:bg-positive/90"
              title={t.chat.sendTooltip}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {t.chat.footerHint}
        </p>
      </div>
    </div>
  );
}
