import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock,
  Hourglass,
  MapPin,
  RefreshCw,
  Ticket,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { AppNav } from "../components/AppNav";
import {
  api,
  errorMessage,
  type EventOut,
  type RegistrationOut,
  type WaitlistOut,
} from "../lib/api";
import { dateParts, daysUntil, parseVenue, timeRange } from "../lib/format";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/ui";
import { EASE } from "../lib/anim";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
  },
  pending: {
    label: "Pending payment",
    className: "bg-gold-500/10 text-gold-300 ring-gold-400/25",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-rose-500/10 text-rose-300 ring-rose-400/25",
  },
};

function BookingStatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? {
    label: status,
    className: "bg-ink-700/50 text-cream-300 ring-ink-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [registrations, setRegistrations] = useState<RegistrationOut[] | null>(
    null,
  );
  const [waitlist, setWaitlist] = useState<WaitlistOut[] | null>(null);
  const [events, setEvents] = useState<Map<number, EventOut> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<{
    reg: RegistrationOut;
    eventName: string;
  } | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<{
    entry: WaitlistOut;
    eventName: string;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [regs, waits, allEvents] = await Promise.all([
        api.listMyRegistrations(user.id),
        api.listMyWaitlist(),
        api.listEvents(),
      ]);
      setRegistrations(regs);
      setWaitlist(waits);
      setEvents(new Map(allEvents.map((e) => [e.id, e])));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventFor = (reg: RegistrationOut) => events?.get(reg.event_id) ?? null;

  const { active, past, queued } = useMemo(() => {
    const regs = registrations ?? [];
    return {
      active: regs.filter((r) => r.status !== "cancelled"),
      past: regs.filter((r) => r.status === "cancelled"),
      queued: waitlist ?? [],
    };
  }, [registrations, waitlist]);

  async function confirmCancel() {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      await api.cancelRegistration(cancelTarget.reg.id);
      toast("success", "Booking cancelled. Any waitlisted attendee is promoted automatically.");
      setCancelTarget(null);
      await load();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  async function confirmLeave() {
    if (!leaveTarget || cancelling) return;
    setCancelling(true);
    try {
      await api.leaveWaitlist(leaveTarget.entry.id);
      toast("success", "You've left the waitlist.");
      setLeaveTarget(null);
      await load();
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-cream-100">
      <AppNav />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10"
      >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
            Attendee
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-cream-50 sm:text-4xl">
            My bookings
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
          >
            Browse events
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh bookings"
            className="rounded-lg border border-ink-700 p-2 text-cream-500 transition hover:border-gold-500/40 hover:text-cream-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900 px-6 py-14 text-center">
          <WifiOff className="h-8 w-8 text-cream-600" aria-hidden />
          <div>
            <p className="font-medium text-cream-100">Couldn't load bookings</p>
            <p className="mt-1 max-w-sm text-sm text-cream-500">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-700 px-4 py-2 text-sm text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Try again
          </button>
        </div>
      )}

      {!error && loading && (
        <div className="mt-8 space-y-4" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-ink-800 bg-ink-900/60" />
          ))}
        </div>
      )}

      {!error && !loading && registrations && registrations.length === 0 && (queued?.length ?? 0) === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-700 bg-ink-900/50 px-6 py-16 text-center">
          <Ticket className="mx-auto h-8 w-8 text-cream-600" aria-hidden />
          <p className="mt-4 font-medium text-cream-100">No bookings yet</p>
          <p className="mt-1 text-sm text-cream-500">
            Pick an event to see its details and book a seat.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
          >
            Browse events
          </Link>
        </div>
      )}

      {!error && !loading && active.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-500">
            Upcoming &amp; active
          </h2>
          <div className="mt-3 space-y-4">
            {active.map((reg) => (
              <BookingCard
                key={reg.id}
                reg={reg}
                event={eventFor(reg)}
                onCancel={() =>
                  setCancelTarget({
                    reg,
                    eventName: eventFor(reg)?.event_name ?? `Event #${reg.event_id}`,
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {!error && !loading && queued.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-500">
            Waitlisted
          </h2>
          <div className="mt-3 space-y-4">
            {queued.map((entry) => (
              <WaitlistCard
                key={entry.id}
                entry={entry}
                event={events?.get(entry.event_id) ?? null}
                onLeave={() =>
                  setLeaveTarget({
                    entry,
                    eventName:
                      events?.get(entry.event_id)?.event_name ?? `Event #${entry.event_id}`,
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {!error && !loading && past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-500">
            Cancelled
          </h2>
          <div className="mt-3 space-y-4">
            {past.map((reg) => (
              <BookingCard key={reg.id} reg={reg} event={eventFor(reg)} />
            ))}
          </div>
        </section>
      )}

      {/* cancel confirmation */}
      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel this booking?"
        description={
          cancelTarget
            ? `${cancelTarget.eventName} (reference #${cancelTarget.reg.id})`
            : undefined
        }
      >
        <p className="text-sm leading-relaxed text-cream-400">
          Your seat will be released. If the event has a waitlist, the next
          attendee is promoted automatically.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setCancelTarget(null)}
            disabled={cancelling}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-cream-300 transition hover:border-ink-600 hover:text-cream-100"
          >
            Keep booking
          </button>
          <button
            type="button"
            onClick={() => void confirmCancel()}
            disabled={cancelling}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            {cancelling ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Cancel booking
          </button>
        </div>
      </Modal>

      {/* leave waitlist confirmation */}
      <Modal
        open={leaveTarget !== null}
        onClose={() => setLeaveTarget(null)}
        title="Leave the waitlist?"
        description={
          leaveTarget
            ? `${leaveTarget.eventName} — position #${leaveTarget.entry.position}`
            : undefined
        }
      >
        <p className="text-sm leading-relaxed text-cream-400">
          You'll give up your place in the queue. If seats open up later you can book
          again while capacity lasts.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setLeaveTarget(null)}
            disabled={cancelling}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-cream-300 transition hover:border-ink-600 hover:text-cream-100"
          >
            Stay in line
          </button>
          <button
            type="button"
            onClick={() => void confirmLeave()}
            disabled={cancelling}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            {cancelling ? <Spinner /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Leave waitlist
          </button>
        </div>
      </Modal>
      </motion.div>
    </div>
  );
}

// booking card

function BookingCard({
  reg,
  event,
  onCancel,
}: {
  reg: RegistrationOut;
  event: EventOut | null;
  onCancel?: () => void;
}) {
  const d = event ? dateParts(event.event_date) : null;
  const { venue, price } = event ? parseVenue(event.venue) : { venue: "", price: null };
  const cancelled = reg.status === "cancelled";

  return (
    <article
      className={`rounded-2xl border bg-ink-900 p-5 transition duration-200 ${
        cancelled ? "border-ink-800 opacity-70" : "border-ink-800 hover:border-gold-500/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {d ? (
            <div className="w-13 shrink-0 rounded-xl border border-ink-700 bg-ink-850 px-2.5 py-2 text-center">
              <p className="font-display text-xl font-semibold leading-none text-gold-400">
                {d.day}
              </p>
              <p className="mt-1 text-[10px] font-bold tracking-widest text-cream-500">
                {d.month}
              </p>
            </div>
          ) : (
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850">
              <Ticket className="h-5 w-5 text-cream-600" aria-hidden />
            </div>
          )}
          <div>
            <h3 className="font-display text-lg leading-snug text-cream-50">
              {event ? (
                <Link
                  to={`/events/${event.id}`}
                  className="transition hover:text-gold-300"
                >
                  {event.event_name}
                </Link>
              ) : (
                `Event #${reg.event_id}`
              )}
            </h3>
            <p className="mt-1 text-xs text-cream-600">
              Booking reference{" "}
              <span className="font-mono text-cream-400">#{reg.id}</span>
              {event && d && (
                <>
                  {" · "}
                  {d.weekday}, {d.short}{" "}
                  · {daysUntil(event.event_date)}
                </>
              )}
            </p>
            {event && d && (
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-cream-300">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gold-600" aria-hidden />
                  {timeRange(event.start_time, event.end_time)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gold-600" aria-hidden />
                  {venue}
                  {price !== null && (
                    <span className="rounded bg-gold-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-gold-300 ring-1 ring-inset ring-gold-500/25">
                      ${price.toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <BookingStatusPill status={reg.status} />
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-cream-400 transition hover:border-rose-400/40 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Cancel
            </button>
          )}
        </div>
      </div>

      {reg.status === "pending" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-cream-500">
          <Hourglass className="h-3.5 w-3.5 text-gold-500" aria-hidden />
          Awaiting payment — complete payment to confirm your seat.
        </p>
      )}
    </article>
  );
}

//waitlist card

function WaitlistCard({
  entry,
  event,
  onLeave,
}: {
  entry: WaitlistOut;
  event: EventOut | null;
  onLeave: () => void;
}) {
  const d = event ? dateParts(event.event_date) : null;
  const { venue } = event ? parseVenue(event.venue) : { venue: "" };

  return (
    <article className="rounded-2xl border border-ink-800 bg-ink-900 p-5 transition duration-200 hover:border-gold-500/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {d ? (
            <div className="w-13 shrink-0 rounded-xl border border-ink-700 bg-ink-850 px-2.5 py-2 text-center">
              <p className="font-display text-xl font-semibold leading-none text-gold-400">
                {d.day}
              </p>
              <p className="mt-1 text-[10px] font-bold tracking-widest text-cream-500">
                {d.month}
              </p>
            </div>
          ) : (
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850">
              <Hourglass className="h-5 w-5 text-cream-600" aria-hidden />
            </div>
          )}
          <div>
            <h3 className="font-display text-lg leading-snug text-cream-50">
              {event ? (
                <Link
                  to={`/events/${event.id}`}
                  className="transition hover:text-gold-300"
                >
                  {event.event_name}
                </Link>
              ) : (
                `Event #${entry.event_id}`
              )}
            </h3>
            <p className="mt-1 text-xs text-cream-600">
              Position{" "}
              <span className="font-semibold text-gold-300">#{entry.position}</span> in line
              {event && d && (
                <>
                  {" · "}
                  {d.weekday}, {d.short}
                </>
              )}
            </p>
            {event && (
              <p className="mt-2.5 flex items-center gap-1.5 text-sm text-cream-300">
                <MapPin className="h-3.5 w-3.5 text-gold-600" aria-hidden />
                {venue}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 px-2.5 py-0.5 text-[11px] font-medium text-gold-300 ring-1 ring-inset ring-gold-400/25">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {entry.status === "promoted" ? "Seat offered" : "Waiting"}
          </span>
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-cream-400 transition hover:border-rose-400/40 hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Leave
          </button>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-cream-500">
        <Hourglass className="h-3.5 w-3.5 text-gold-500" aria-hidden />
        You'll be booked automatically when a seat opens up.
      </p>
    </article>
  );
}
