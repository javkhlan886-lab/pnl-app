import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Square, ChevronDown, Brain, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getPNLList } from "@/lib/pnl";
import { getUsers, getAuditLogs } from "@/lib/admin";
import { getTransactions } from "@/lib/transaction";
import { useAiPageContext } from "@/lib/aiPageContext";
import { PNLRecord } from "@/types";
import api from "@/lib/axios";
import {
  streamChat,
  buildSystemInstruction,
  geminiConfigured,
  GEMINI_MODEL,
  LEVEL_BY_ROLE,
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

// Түвшин тус бүрд тохирсон санал — эрхгүй датаг асуухаас сэргийлж,
// хэрэглэгчид өөрт хэрэгтэй асуултыг шууд үзүүлнэ.
const SUGGESTIONS: Record<1 | 2 | 3 | 4, string[]> = {
  1: [
    "Хамгийн ашигтай гэрээ аль нь вэ? Маржинаар харьцуулж хэлээрэй.",
    "Хэрэглэгч тус бүр хэдэн тайлан оруулсан, хэн хамгийн их орлого бүртгэсэн бэ?",
    "Сүүлийн үйлдлүүдэд анхаарал татах зүйл байна уу? Устгал, эрх солилтыг дүгнэ.",
    "Зөвшөөрөл хүлээж байгаа хэрэглэгч байна уу?",
  ],
  2: [
    "Одоогийн цэвэр ашиг хэр байна, ямар зардал хамгийн их дарамт болж байна?",
    "Хамгийн ашигтай гэрээ аль нь вэ? Маржинаар харьцуулж хэлээрэй.",
    "Хэрэглэгч тус бүрийн оруулсан тайлангуудыг харьцуулж дүгнээрэй.",
    "Алдагдалтай тайлангууд байна уу? Шалтгааныг тоогоор тайлбарлаарай.",
  ],
  3: [
    "Надад харагдаж байгаа тайлангуудыг ашгаар эрэмбэлээрэй.",
    "Миний харах эрхтэй хүрээний нийт орлого, зардал хэд вэ?",
    "Алдагдалтай гэрээ байна уу? Шалтгааныг тоогоор тайлбарлаарай.",
    "Анхаарах шаардлагатай авлага, зээл байна уу?",
  ],
  4: [
    "Миний оруулсан тайлангуудын нийт орлого, ашиг хэд вэ?",
    "Миний хамгийн ашигтай гэрээ аль нь вэ?",
    "Алдагдалтай тайлан байна уу? Шалтгааныг тайлбарлаарай.",
    "Тайлангаа сайжруулахад юуг анхаарах ёстой вэ?",
  ],
};

// Панелийн header-т хамрах хүрээг тодоор үзүүлнэ.
const SCOPE_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "Бүх дата · хэрэглэгч, лог",
  2: "Бүх хэрэглэгчийн дата",
  3: "Танд assign хийсэн дата",
  4: "Зөвхөн таны дата",
};

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
  const { user, loading: authLoading } = useAuth();
  // Эрх нь тодорхойгүй байвал хамгийн хязгаарлагдмал түвшинг (4) авна.
  const level = (user?.role ? LEVEL_BY_ROLE[user.role] : undefined) ?? 4;

  const [open, setOpen] = useState(false);
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
      // Зөвхөн Level 1 — эдгээр endpoint нь backend дээр requireAdmin-аар
      // хамгаалагдсан тул бусад түвшин хүсэлт тавьсан ч 403 авна.
      level === 1
        ? Promise.all([
            getUsers().catch(() => []),
            getAuditLogs({ limit: 30 }).then((r) => r.logs).catch(() => []),
          ]).then(([users, logs]): AdminContext => ({
            users: users.map((u) => ({ email: u.email, name: u.name, role: u.role, status: u.status })),
            logs: logs.map((l) => ({
              actorEmail: l.actorEmail,
              action: l.action,
              entityType: l.entityType,
              description: l.description,
              createdAt: l.createdAt,
            })),
          }))
        : Promise.resolve(null),
    ]).then(([summary, records, txTotals, admin]) =>
      setContext({ summary, records, txTotals, admin })
    );
  }, [open, context, authLoading, level]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Component unmount болоход хагас дуусаагүй stream-ийг зогсооно.
  useEffect(() => () => abortRef.current?.abort(), []);

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
          pageContext,
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
          : { ...m, text: "Хариулт хоосон ирлээ. Асуултаа өөр үгээр оруулж үзээрэй.", error: true }
      );
    } catch (err: any) {
      const msg = err?.message || "Gemini API-тай холбогдоход алдаа гарлаа";
      patch((m) => ({ ...m, text: m.text || msg, error: !m.text }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="P&L Ассистент"
        className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full flex items-center gap-2 text-sm font-medium
                   bg-positive text-background shadow-[0_0_24px_color-mix(in_oklch,oklch(var(--positive))_40%,transparent)]
                   hover:bg-positive/90 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Таны туслах Дэлгэр байна
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
            P&L Ассистент
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-info/15 text-info shrink-0">
              Level {level}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground truncate" title={GEMINI_MODEL}>
            {SCOPE_LABEL[level]}
            {pageContext ? ` · ${pageContext.title}` : ""}
            {context ? "" : " · уншиж байна…"}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} title="Харилцааг цэвэрлэх"
            className="text-muted-foreground hover:text-destructive p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => setOpen(false)} title="Хаах"
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
              <span className="font-medium">VITE_GEMINI_API_KEY</span> тохируулаагүй байна.
              <code className="mx-1">.env.local</code> файлд key-г нэмээд dev server-ээ дахин ажиллуулна уу.
            </p>
          </div>
        )}

        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Санхүүгийн тоонуудынхаа талаар асууж болно. Ассистент нь{" "}
              <span className="text-foreground">{SCOPE_LABEL[level].toLowerCase()}</span>-г л
              харж хариулна — эрхээс гадуурх мэдээллийг хэлэхгүй.
            </p>
            <div className="space-y-1.5">
              {/* Одоогийн дэлгэцэд тохирсон санал — эхэнд онцолж үзүүлнэ */}
              {pageContext && (
                <button
                  onClick={() => send(`${pageContext.title} дээр одоо харагдаж байгаа цэвэр дүнг тайлбарлаж дүгнээрэй.`)}
                  disabled={!geminiConfigured || authLoading}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-info/30 bg-info/10
                             text-info hover:bg-info/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {pageContext.title} дээрх цэвэр дүнг тайлбарлаж дүгнээрэй
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
                    {streaming && !m.text ? "Тунгааж байна…" : "Тунгаалт"}
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
                !m.thought && <p className="text-xs text-muted-foreground">Бичиж байна…</p>
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
                ? "API key тохируулаагүй"
                : authLoading
                  ? "Эрх шалгаж байна…"
                  : "Асуултаа бичнэ үү…"
            }
            disabled={!geminiConfigured || authLoading}
            className="flex-1 max-h-28 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1
                       focus-visible:ring-ring disabled:opacity-50"
          />
          {streaming ? (
            <Button size="icon" variant="outline" onClick={stop} title="Зогсоох">
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={() => send(input)}
              disabled={!input.trim() || !geminiConfigured || authLoading}
              className="bg-positive text-background hover:bg-positive/90"
              title="Илгээх"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Enter — илгээх · Shift+Enter — шинэ мөр. AI-ийн хариултыг шийдвэр гаргахын өмнө шалгаарай.
        </p>
      </div>
    </div>
  );
}
