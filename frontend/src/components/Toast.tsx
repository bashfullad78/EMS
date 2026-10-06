import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { EASE } from "../lib/anim";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ toast: (kind: ToastKind, message: string) => void } | null>(
  null,
);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const KIND_STYLE: Record<ToastKind, { icon: typeof CircleCheck; ring: string; iconColor: string }> = {
  success: { icon: CircleCheck, ring: "ring-emerald-400/30", iconColor: "text-emerald-300" },
  error: { icon: CircleAlert, ring: "ring-rose-400/30", iconColor: "text-rose-300" },
  info: { icon: Info, ring: "ring-gold-400/30", iconColor: "text-gold-300" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const style = KIND_STYLE[t.kind];
            const Icon = style.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ duration: 0.26, ease: EASE }}
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] ring-1 ring-inset ${style.ring}`}
              >
                <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${style.iconColor}`} aria-hidden />
                <p className="flex-1 text-sm leading-snug text-cream-100">{t.message}</p>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                  className="rounded p-0.5 text-cream-600 transition hover:text-cream-300"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
