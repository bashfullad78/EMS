import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { EventStatus } from "../lib/api";

//status pill

const STATUS_STYLES: Record<EventStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-ink-700/50 text-cream-300 ring-ink-600" },
  scheduled: {
    label: "Scheduled",
    className: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
  },
  completed: { label: "Completed", className: "bg-sky-500/10 text-sky-300 ring-sky-400/25" },
  cancelled: { label: "Cancelled", className: "bg-rose-500/10 text-rose-300 ring-rose-400/25" },
};

export function StatusPill({ status, className = "" }: { status: EventStatus; className?: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.className} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}

//capacity meter

export function CapacityMeter({
  confirmed,
  capacity,
  className = "",
}: {
  confirmed: number;
  capacity: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((confirmed / Math.max(1, capacity)) * 100));
  const full = confirmed >= capacity;
  const tone = full ? "bg-rose-400" : pct >= 70 ? "bg-gold-400" : "bg-emerald-400";
  return (
    <div className={className}>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full w-full origin-left rounded-full transition-transform duration-700 ease-out ${tone}`}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-cream-500">
        <span className="text-cream-300">{confirmed}</span>
        {" / "}
        {capacity} seats
        {full && <span className="ml-1.5 font-medium text-rose-300">Full</span>}
      </p>
    </div>
  );
}

//spinner

export function Spinner({ className = "" }: { className?: string }) {
  return <LoaderCircle className={`h-4 w-4 animate-spin ${className}`} aria-hidden />;
}

//field

export const inputClass =
  "w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm text-cream-100 " +
  "placeholder:text-cream-600 outline-none transition " +
  "focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20 disabled:opacity-50";

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-cream-500">
        {label}
        {required && <span className="text-gold-400">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-cream-600">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
    </label>
  );
}
