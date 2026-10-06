import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Hourglass,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { api, errorMessage, type EventOut, type ReportOut } from "../../lib/api";
import { dateParts, daysUntil, formatMoney, timeRange } from "../../lib/format";
import { Spinner, StatusPill } from "../../components/ui";
import { Reveal } from "../../components/Reveal";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../auth/AuthContext";
import { EASE } from "../../lib/anim";
import { motion } from "framer-motion";
import type { EventStatus } from "../../lib/api";

const STATUS_ORDER: EventStatus[] = ["draft", "scheduled", "completed", "cancelled"];

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [eventReport, setEventReport] = useState<ReportOut | null>(null);
  const [regReport, setRegReport] = useState<ReportOut | null>(null);
  const [upcoming, setUpcoming] = useState<EventOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [er, rr, events] = await Promise.all([
        api.eventReport(),
        api.registrationReport(),
        api.listEvents("scheduled"),
      ]);
      setEventReport(er);
      setRegReport(rr);
      setUpcoming(events.slice(0, 3));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    toast("info", "Reports regenerated");
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const er = eventReport?.report_data;
  const rr = regReport?.report_data;
  const byStatus = er?.events_by_status ?? {};
  const regByStatus = rr?.registrations_by_status ?? {};
  const totalEvents =
    er?.total_events ?? STATUS_ORDER.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-1.5 font-display text-3xl tracking-tight text-cream-50 sm:text-4xl">
            {greeting}, {user?.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-sm text-cream-500">
            Here's what's happening across your events.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-700 px-3.5 py-2 text-sm text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100 disabled:opacity-60"
        >
          {refreshing ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Refresh reports
        </button>
      </div>

      {error && (
        <Reveal className="mt-8">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900 px-6 py-14 text-center">
            <WifiOff className="h-8 w-8 text-cream-600" aria-hidden />
            <div>
              <p className="font-medium text-cream-100">Couldn't load the dashboard</p>
              <p className="mt-1 max-w-sm text-sm text-cream-500">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
            >
              Try again
            </button>
          </div>
        </Reveal>
      )}

      {loading && !error && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-ink-800 bg-ink-900/60" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={CalendarDays}
              label="Total events"
              value={totalEvents}
              delay={0}
            />
            <StatCard
              icon={Users}
              label="Confirmed bookings"
              value={regByStatus.confirmed ?? 0}
              delay={80}
            />
            <StatCard
              icon={Hourglass}
              label="On waitlist"
              value={regByStatus.waitlisted ?? 0}
              delay={160}
            />
            <StatCard
              icon={Wallet}
              label="Revenue collected"
              value={rr?.revenue ?? 0}
              format={formatMoney}
              delay={240}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal delay={120}>
              <section className="h-full rounded-2xl border border-ink-800 bg-ink-900 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg tracking-tight text-cream-50">
                    Events by status
                  </h2>
                  <TrendingUp className="h-4.5 w-4.5 text-gold-500" aria-hidden />
                </div>
                <ul className="mt-5 space-y-4">
                  {STATUS_ORDER.map((status, i) => {
                    const count = byStatus[status] ?? 0;
                    const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;
                    return (
                      <li key={status}>
                        <div className="flex items-center justify-between text-sm">
                          <StatusPill status={status} />
                          <span className="font-display text-lg text-cream-100">{count}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: pct / 100 }}
                            transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: EASE }}
                            className={`h-full w-full origin-left rounded-full ${
                              status === "cancelled"
                                ? "bg-rose-400/70"
                                : status === "completed"
                                  ? "bg-sky-400/70"
                                  : status === "scheduled"
                                    ? "bg-emerald-400/70"
                                    : "bg-cream-500/60"
                            }`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-5 border-t border-ink-800 pt-4 text-xs text-cream-600">
                  Total capacity across all events:{" "}
                  <span className="font-medium text-cream-300">{er?.total_capacity ?? 0}</span> seats
                </p>
              </section>
            </Reveal>

            <Reveal delay={200}>
              <section className="h-full rounded-2xl border border-ink-800 bg-ink-900 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg tracking-tight text-cream-50">
                    Next up
                  </h2>
                  <Link
                    to="/admin/events"
                    className="flex items-center gap-1 text-xs font-medium text-gold-400 transition hover:text-gold-300"
                  >
                    All events <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>

                {upcoming.length === 0 ? (
                  <p className="mt-6 rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-cream-600">
                    No scheduled events — time to create one.
                  </p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {upcoming.map((event) => {
                      const d = dateParts(event.event_date);
                      return (
                        <li key={event.id}>
                          <Link
                            to="/admin/events"
                            className="group flex items-center gap-4 rounded-xl border border-ink-800 bg-ink-850/60 p-3.5 transition hover:border-gold-500/30"
                          >
                            <div className="w-12 shrink-0 rounded-lg bg-ink-900 px-2 py-2 text-center ring-1 ring-inset ring-ink-700">
                              <p className="font-display text-base font-semibold leading-none text-gold-400">
                                {d.day}
                              </p>
                              <p className="mt-1 text-[9px] font-bold tracking-widest text-cream-500">
                                {d.month}
                              </p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-cream-100">
                                {event.event_name}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-cream-500">
                                <Clock className="h-3 w-3" aria-hidden />
                                {timeRange(event.start_time, event.end_time)} ·{" "}
                                {daysUntil(event.event_date)}
                              </p>
                            </div>
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-cream-600 transition group-hover:translate-x-0.5 group-hover:text-gold-400"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}

//stat

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function StatCard({
  icon: Icon,
  label,
  value,
  format = (n: number) => String(n),
  delay,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: number;
  format?: (n: number) => string;
  delay: number;
}) {
  const shown = useCountUp(value);
  return (
    <Reveal delay={delay}>
      <div className="h-full rounded-2xl border border-ink-800 bg-ink-900 p-5 transition hover:border-ink-700">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-cream-500">
            {label}
          </p>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/10 ring-1 ring-inset ring-gold-500/25">
            <Icon className="h-4 w-4 text-gold-400" aria-hidden />
          </span>
        </div>
        <p className="mt-3 font-display text-3xl tracking-tight text-cream-50">
          {format(shown)}
        </p>
      </div>
    </Reveal>
  );
}
