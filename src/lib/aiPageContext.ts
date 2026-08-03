import { useSyncExternalStore } from "react";

// ─── AI-д зориулсан "одоо дэлгэц дээр юу байна" контекст ───────────────────
// Хуудсууд өөрсдийн харагдаж байгаа тоог (шүүлтүүрийн дараах дүн гэх мэт)
// энд бүртгэнэ. ChatSection нь App-ийн route wrapper-д рендерлэгддэг тул
// хуудасны child биш — иймд React context-ийн оронд модул хэмжээний
// жижиг store ашиглана.
export interface AiPageContext {
  /** Дэлгэцийн нэр — prompt-д гарна. Ж: "Гүйлгээний дэвтэр" */
  title: string;
  /** "шошго: дүн" хэлбэрийн бэлэн мөрүүд */
  lines: string[];
}

let current: AiPageContext | null = null;
const listeners = new Set<() => void>();

export function setAiPageContext(ctx: AiPageContext | null) {
  current = ctx;
  listeners.forEach((l) => l());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

const getSnapshot = () => current;

export function useAiPageContext(): AiPageContext | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
