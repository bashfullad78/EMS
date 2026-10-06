import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hourglass,
  KeyRound,
  MapPin,
  RefreshCw,
  Ticket,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  api,
  errorMessage,
  type BookingResult,
  type EventWithCounts,
  type PaymentOut,
  type RegistrationOut,
  type WaitlistOut,
} from "../lib/api";
import {
  dateParts,
  daysUntil,
  formatMoney,
  parseVenue,
  timeRange,
} from "../lib/format";
import { CapacityMeter, Spinner, StatusPill } from "../components/ui";
import { AppNav } from "../components/AppNav";
import { Reveal } from "../components/Reveal";
import { EASE } from "../lib/anim";

/** The dummy gateway is in-process (instant); a brief pause just makes the
 * processing state visible in the UI. */
const GATEWAY_DELAY_MS = 800;

type BookingState =
  | { phase: "idle" }
  | { phase: "processing" }
  | { phase: "done"; result: BookingResult }
  | { phase: "error"; message: string };

/** The signed-in user's existing relationship with the event. */
type SeatState =
  | { kind: "booked"; registration: RegistrationOut }
  | { kind: "waiting"; entry: WaitlistOut };

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventWithCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingState>({ phase: "idle" });
  // Signed-in users: their existing registration / waitlist entry for this event.
  const [myRegistration, setMyRegistration] = useState<RegistrationOut | null>(null);
  const [myWaitEntry, setMyWaitEntry] = useState<WaitlistOut | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const ev = await api.getEvent(Number(id));
      setEvent(ev);
      if (user) {
        const [regs, waits] = await Promise.all([
          api.listMyRegistrations(user.id),
          api.listMyWaitlist(),
        ]);
        setMyRegistration(
          regs.find((r) => r.event_id === ev.id && r.status !== "cancelled") ?? null,
        );
        setMyWaitEntry(waits.find((w) => w.event_id === ev.id) ?? null);
      } else {
        setMyRegistration(null);
        setMyWaitEntry(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    setBooking({ phase: "idle" });
    void load();
  }, [load]);

  const d = event ? dateParts(event.event_date) : null;
  const { venue, price } = event ? parseVenue(event.venue) : { venue: "", price: null };
  const full = event ? event.confirmed_bookings >= event.capacity : false;
  const bookable = event?.status === "scheduled";
  // The user already holds a seat (or is in the queue) for this event.
  const seatState: SeatState | null = myRegistration
    ? { kind: "booked", registration: myRegistration }
    : myWaitEntry
      ? { kind: "waiting", entry: myWaitEntry }
      : null;

  async function onBook() {
    if (!event || booking.phase === "processing") return;
    setBooking({ phase: "processing" });
    try {
      if (price !== null) await new Promise((r) => setTimeout(r, GATEWAY_DELAY_MS));
      const result = await api.createRegistration(event.id);
      setBooking({ phase: "done", result });
      // Refresh live counts silently (a seat was taken / waitlist grew).
      await load({ silent: true });
    } catch (err) {
      setBooking({ phase: "error", message: errorMessage(err) });
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-cream-100">
      <AppNav />

      <main className="relative mx-auto max-w-6xl px-6 pb-28 pt-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-cream-500 transition hover:text-cream-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All events
        </Link>

        {loading && (
          <div className="mt-8 h-72 animate-pulse rounded-2xl border border-ink-800 bg-ink-900/60" />
        )}

        {error && (
          <Reveal className="mt-8">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900 px-6 py-14 text-center">
              <WifiOff className="h-8 w-8 text-cream-600" aria-hidden />
              <div>
                <p className="font-medium text-cream-100">Couldn't load this event</p>
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
          </Reveal>
        )}
        {!loading && !error && event && d && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr]"
          >
            {/* ------------------------------------------------ info column */}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={event.status} />
                {price !== null && (
                  <span className="rounded-full bg-gold-500/10 px-3 py-1 text-sm font-semibold text-gold-300 ring-1 ring-inset ring-gold-500/25">
                    {formatMoney(price)}
                  </span>
                )}
              </div>

              <h1 className="mt-4 font-display text-4xl tracking-tight text-cream-50 sm:text-5xl">
                {event.event_name}
              </h1>

              <div className="mt-6 space-y-3 text-sm text-cream-300">
                <p className="flex items-center gap-2.5">
                  <CalendarDays className="h-4.5 w-4.5 shrink-0 text-gold-500" aria-hidden />
                  {d.long}
                  <span className="text-cream-600">· {daysUntil(event.event_date)}</span>
                </p>
                <p className="flex items-center gap-2.5">
                  <Clock className="h-4.5 w-4.5 shrink-0 text-gold-500" aria-hidden />
                  {timeRange(event.start_time, event.end_time)}
                </p>
                <p className="flex items-center gap-2.5">
                  <MapPin className="h-4.5 w-4.5 shrink-0 text-gold-500" aria-hidden />
                  {venue}
                </p>
                <div className="flex items-center gap-2.5">
                  <Users className="h-4.5 w-4.5 shrink-0 text-gold-500" aria-hidden />
                  <span className="flex-1">
                    <CapacityMeter confirmed={event.confirmed_bookings} capacity={event.capacity} />
                  </span>
                </div>
                {event.waitlist_count > 0 && (
                  <p className="flex items-center gap-2.5 text-cream-400">
                    <Hourglass className="h-4.5 w-4.5 shrink-0 text-gold-500" aria-hidden />
                    {event.waitlist_count} on the waitlist
                  </p>
                )}
              </div>

              {event.description && (
                <div className="mt-8 rounded-2xl border border-ink-800 bg-ink-900 p-6">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
                    About this event
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-cream-300">
                    {event.description}
                  </p>
                </div>
              )}
            </div>

            {/* --------------------------------------------- booking column */}
            <Reveal delay={120}>
              <div className="sticky top-24 rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
                <h2 className="font-display text-xl tracking-tight text-cream-50">
                  Your seat
                </h2>

                {!user && (
                  <div className="mt-4">
                    <p className="text-sm leading-relaxed text-cream-500">
                      Sign in (or create a free account) to book a seat
                      {price !== null ? ` and pay the ${formatMoney(price)} fee` : ""}.
                    </p>
                    <Link
                      to="/login"
                      state={{ from: `/events/${event.id}` }}
                      className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
                    >
                      <KeyRound className="h-4 w-4" aria-hidden />
                      Sign in to book
                    </Link>
                  </div>
                )}

                {user && !bookable && !seatState && (
                  <p className="mt-4 rounded-lg border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-sm text-cream-400">
                    Booking is closed — this event is{" "}
                    <span className="text-cream-300">{event.status}</span>.
                  </p>
                )}

                {user && seatState && booking.phase !== "done" && (
                  <ExistingSeat state={seatState} />
                )}

                {user && bookable && !seatState && booking.phase !== "done" && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void onBook()}
                      disabled={booking.phase === "processing"}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {booking.phase === "processing" ? (
                        <>
                          <Spinner />
                          {price !== null ? "Processing payment…" : "Booking…"}
                        </>
                      ) : full ? (
                        <>
                          <Hourglass className="h-4 w-4" aria-hidden />
                          Join waitlist
                        </>
                      ) : price !== null ? (
                        <>
                          <Wallet className="h-4 w-4" aria-hidden />
                          Book &amp; pay {formatMoney(price)}
                        </>
                      ) : (
                        <>
                          <Ticket className="h-4 w-4" aria-hidden />
                          Book seat
                        </>
                      )}
                    </button>
                    {full && (
                      <p className="mt-2.5 text-xs leading-relaxed text-cream-600">
                        This event is full — you'll be added to the waitlist and
                        promoted automatically if a seat opens up.
                      </p>
                    )}
                    {price !== null && !full && (
                      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-cream-600">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                        Demo gateway — the fee is simulated, no real charge.
                      </p>
                    )}
                    {booking.phase === "error" && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
                      >
                        {booking.message}
                      </p>
                    )}
                  </div>
                )}

                {user && bookable && booking.phase === "done" && (
                  <BookingConfirmation result={booking.result} />
                )}
              </div>
            </Reveal>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------- booking confirmation

/** Already holds a seat or is queued: shows status instead of a book button. */
function ExistingSeat({ state }: { state: SeatState }) {
  if (state.kind === "booked") {
    const { registration } = state;
    return (
      <div className="mt-4">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <div>
            <p className="font-medium text-cream-100">
              {registration.status === "pending" ? "Seat reserved — payment pending" : "You're booked"}
            </p>
            <p className="mt-1 text-sm text-cream-400">
              Reference{" "}
              <span className="font-mono font-semibold text-cream-200">#{registration.id}</span>
            </p>
          </div>
        </div>
        <Link
          to="/bookings"
          className="mt-3 block rounded-xl border border-ink-700 px-5 py-2.5 text-center text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
        >
          Manage booking
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-start gap-3 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-4 py-3.5">
        <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" aria-hidden />
        <div>
          <p className="font-medium text-cream-100">You're on the waitlist</p>
          <p className="mt-1 text-sm text-cream-400">
            Position{" "}
            <span className="font-semibold text-gold-300">#{state.entry.position}</span> — you'll
            be booked automatically if a seat opens up.
          </p>
        </div>
      </div>
      <Link
        to="/bookings"
        className="mt-3 block rounded-xl border border-ink-700 px-5 py-2.5 text-center text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
      >
        View my bookings
      </Link>
    </div>
  );
}

function BookingConfirmation({ result }: { result: BookingResult }) {
  if (result.result === "waitlisted") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="mt-4"
      >
        <div className="flex items-start gap-3 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-4 py-3.5">
          <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" aria-hidden />
          <div>
            <p className="font-medium text-cream-100">You're on the waitlist</p>
            <p className="mt-1 text-sm text-cream-400">
              Position <span className="font-semibold text-gold-300">#{result.waitlist.position}</span>{" "}
              — you'll be booked automatically if a seat opens up, and notified.
            </p>
          </div>
        </div>
        <Link
          to="/bookings"
          className="mt-3 block rounded-xl border border-ink-700 px-5 py-2.5 text-center text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
        >
          View my bookings
        </Link>
      </motion.div>
    );
  }

  const { registration, payment } = result;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="mt-4"
    >
      <div className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] px-4 py-3.5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
        <div>
          <p className="font-medium text-cream-100">Booking confirmed</p>
          <p className="mt-1 text-sm text-cream-400">
            Reference{" "}
            <span className="font-mono font-semibold text-cream-200">
              #{registration.id}
            </span>{" "}
            · {new Date(registration.booking_date).toLocaleString()}
          </p>
        </div>
      </div>

      {payment && <PaymentReceipt payment={payment} />}

      <Link
        to="/bookings"
        className="mt-3 block rounded-xl border border-ink-700 px-5 py-2.5 text-center text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
      >
        View my bookings
      </Link>
    </motion.div>
  );
}

function PaymentReceipt({ payment }: { payment: PaymentOut }) {
  const amount = typeof payment.amount === "number" ? payment.amount : Number(payment.amount);
  return (
    <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-cream-500">
        Payment receipt
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-cream-500">Amount</dt>
          <dd className="font-semibold text-gold-300">{formatMoney(amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-cream-500">Status</dt>
          <dd className="capitalize text-emerald-300">{payment.status}</dd>
        </div>
        {payment.transaction_id && (
          <div className="flex justify-between">
            <dt className="text-cream-500">Transaction</dt>
            <dd className="font-mono text-xs text-cream-300">{payment.transaction_id}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
