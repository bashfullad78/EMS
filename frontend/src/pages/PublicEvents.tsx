import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Hourglass,
  MapPin,
  RefreshCw,
  Ticket,
  Users,
  WifiOff,
} from "lucide-react";
import { api, errorMessage, type EventWithCounts } from "../lib/api";
import { dateParts, daysUntil, formatMoney, parseVenue, timeRange } from "../lib/format";
import { CapacityMeter, StatusPill } from "../components/ui";
import { AppNav } from "../components/AppNav";
import { Reveal } from "../components/Reveal";
import { EASE } from "../lib/anim";

export default function PublicEvents() {
  const [events, setEvents] = useState<EventWithCounts[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The list endpoint already includes booking/waitlist counts.
      setEvents(await api.listEvents("scheduled"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hero = events && events.length > 0 ? events[0] : null;

  const stats = useMemo(() => {
    if (!events) return null;
    return {
      events: events.length,
      seats: events.reduce((sum, e) => sum + e.capacity, 0),
      booked: events.reduce((sum, e) => sum + e.confirmed_bookings, 0),
    };
  }, [events]);

  return (
    <div className="min-h-screen bg-ink-950 text-cream-100">
      <AppNav />

      {/*hero */}
      <header className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-48 left-1/2 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[130px]" />
          <div className="absolute -right-24 top-1/3 h-[340px] w-[420px] rounded-full bg-orange-600/[0.07] blur-[110px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-28">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-300"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold-400" />
              </span>
              Event Management System
            </motion.p>

            <h1 className="mt-6 font-display text-[clamp(2.6rem,7vw,4.9rem)] font-medium leading-[1.04] tracking-tight text-cream-50">
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
              >
                Upcoming events.
              </motion.span>
              <motion.span
                className="block italic text-gold-400"
                initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
              >
                One click to book.
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.34, ease: EASE }}
              className="mt-6 max-w-md text-base leading-relaxed text-cream-500 sm:text-lg"
            >
              Pick an event to see the details and book a seat. If it's full, you can join the
              waitlist and you'll be moved in automatically when a seat opens up.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.46, ease: EASE }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <a
                href="#events"
                className="group inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-[0_12px_32px_-12px_rgba(221,167,55,0.55)] transition hover:-translate-y-0.5 hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
              >
                Browse events
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </a>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-700 px-5 py-3 text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
              >
                Sign in
              </Link>
            </motion.div>

            {stats && stats.events > 0 && (
              <Reveal delay={650} className="mt-12">
                <dl className="flex divide-x divide-ink-700">
                  {[
                    { label: "Upcoming", value: stats.events },
                    { label: "Seats", value: stats.seats },
                    { label: "Booked", value: stats.booked },
                  ].map((s) => (
                    <div key={s.label} className="pr-6 pl-6 first:pl-0 sm:pr-10 sm:pl-10">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-cream-600">
                        {s.label}
                      </dt>
                      <dd className="mt-1 font-display text-3xl text-cream-50">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            )}
          </div>

          <HeroTicket event={hero} />
        </div>
      </header>

      {/*events */}
      <main id="events" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 pb-28">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
                What's on
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-cream-50 sm:text-4xl">
                Upcoming events
              </h2>
            </div>
            <p className="flex items-center gap-2 text-xs text-cream-600">
              <RefreshCw className="h-3.5 w-3.5 text-gold-500" aria-hidden />
              Seat counts refresh with every booking
            </p>
          </div>
        </Reveal>

        {error && (
          <Reveal className="mt-10">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900 px-6 py-14 text-center">
              <WifiOff className="h-8 w-8 text-cream-600" aria-hidden />
              <div>
                <p className="font-medium text-cream-100">Couldn't load events</p>
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

        {!error && loading && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-ink-800 bg-ink-900/60" />
            ))}
          </div>
        )}

        {!error && !loading && events && events.length === 0 && (
          <Reveal className="mt-10">
            <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/50 px-6 py-16 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-cream-600" aria-hidden />
              <p className="mt-4 font-medium text-cream-100">Nothing scheduled yet</p>
              <p className="mt-1 text-sm text-cream-500">
                No upcoming events are open for booking right now.
              </p>
            </div>
          </Reveal>
        )}

        {!error && !loading && events && events.length > 0 && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, i) => (
              <Reveal key={event.id} delay={Math.min(i * 90, 450)}>
                <EventCard event={event} />
              </Reveal>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-cream-600">
          <p className="flex items-center gap-2">
            <Ticket className="h-3.5 w-3.5 text-gold-600" aria-hidden />
            EMS — Event Management System
          </p>
          <p>
            FastAPI + React demo ·{" "}
            <Link to="/login" className="text-cream-500 underline-offset-4 hover:text-gold-400 hover:underline">
              Admin console
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

//hero ticket

function HeroTicket({ event }: { event: EventWithCounts | null }) {
  if (!event) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 32, rotate: 3 }}
        animate={{ opacity: 1, y: 0, rotate: 2 }}
        transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
        className="hidden lg:block"
      >
        <div className="rotate-2">
          <div className="animate-float relative rounded-2xl border border-ink-700 bg-ink-900 p-6 opacity-60">
            <Ticket className="h-10 w-10 text-ink-600" aria-hidden />
            <p className="mt-4 font-display text-xl text-cream-600">Next event — TBA</p>
            <p className="mt-1 text-sm text-cream-600">Check back soon.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const d = dateParts(event.event_date);
  const { venue, price } = parseVenue(event.venue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 36, rotate: 5 }}
      animate={{ opacity: 1, y: 0, rotate: 2 }}
      transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
      className="hidden lg:block"
    >
      <div className="rotate-2">
        <div className="animate-float relative rounded-2xl border border-gold-500/25 bg-gradient-to-b from-ink-850 to-ink-900 p-6 shadow-[0_32px_70px_-24px_rgba(0,0,0,0.75)]">
          {/* ticket notches */}
          <span aria-hidden className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink-950" />
          <span aria-hidden className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-ink-950" />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="rounded-xl bg-gold-500 px-3.5 py-2.5 text-center text-ink-950">
                <p className="font-display text-2xl font-semibold leading-none">{d.day}</p>
                <p className="mt-1 text-[10px] font-bold tracking-widest">{d.month}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-400">
                  {daysUntil(event.event_date)}
                </p>
                <h3 className="mt-1 max-w-[220px] font-display text-lg leading-snug text-cream-50">
                  {event.event_name}
                </h3>
              </div>
            </div>
            <span className="rounded-full border border-ink-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-cream-500">
              Admit one
            </span>
          </div>

          <div className="my-5 border-t border-dashed border-ink-600" />

          <div className="space-y-2 text-sm text-cream-300">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gold-500" aria-hidden />
              {venue}
              {price !== null && (
                <span className="ml-auto rounded-md bg-gold-500/10 px-2 py-0.5 text-xs font-semibold text-gold-300 ring-1 ring-inset ring-gold-500/25">
                  {formatMoney(price)}
                </span>
              )}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold-500" aria-hidden />
              {timeRange(event.start_time, event.end_time)}
            </p>
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gold-500" aria-hidden />
              {event.confirmed_bookings} going
              {event.waitlist_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-cream-500">
                  <Hourglass className="h-3 w-3" aria-hidden /> {event.waitlist_count} waitlisted
                </span>
              )}
            </p>
          </div>

          {/* decorative barcode */}
          <div aria-hidden className="mt-5 flex h-8 items-stretch gap-[3px]">
            {Array.from({ length: 36 }, (_, i) => 2 + ((i * 7 + event.id * 3) % 3) * 2).map(
              (w, i) => (
                <span key={i} className="flex-1 rounded-[1px] bg-cream-300/25" style={{ maxWidth: w }} />
              ),
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// event card

function EventCard({ event }: { event: EventWithCounts }) {
  const d = dateParts(event.event_date);
  const { venue, price } = parseVenue(event.venue);

  return (
    <Link
      to={`/events/${event.id}`}
      aria-label={`View details and book ${event.event_name}`}
      className="group flex h-full flex-col rounded-2xl border border-ink-800 bg-ink-900 p-5 transition duration-200 hover:-translate-y-1 hover:border-gold-500/35 hover:shadow-[0_24px_50px_-24px_rgba(0,0,0,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-13 rounded-xl border border-ink-700 bg-ink-850 px-2.5 py-2 text-center">
            <p className="font-display text-xl font-semibold leading-none text-gold-400">{d.day}</p>
            <p className="mt-1 text-[10px] font-bold tracking-widest text-cream-500">{d.month}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cream-600">
              {d.weekday} · {daysUntil(event.event_date)}
            </p>
            <h3 className="mt-0.5 font-display text-lg leading-snug text-cream-50 transition group-hover:text-gold-300">
              {event.event_name}
            </h3>
          </div>
        </div>
        <StatusPill status={event.status} />
      </div>

      {event.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-cream-500">
          {event.description}
        </p>
      )}

      <div className="mt-4 space-y-1.5 text-sm text-cream-300">
        <p className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
          <span className="truncate">{venue}</span>
          {price !== null && (
            <span className="ml-auto shrink-0 rounded-md bg-gold-500/10 px-2 py-0.5 text-xs font-semibold text-gold-300 ring-1 ring-inset ring-gold-500/25">
              {formatMoney(price)}
            </span>
          )}
        </p>
        <p className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
          {timeRange(event.start_time, event.end_time)}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <div className="flex items-end justify-between gap-4">
          <CapacityMeter confirmed={event.confirmed_bookings} capacity={event.capacity} />
          {event.waitlist_count > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-850 px-2.5 py-1 text-[11px] text-cream-500 ring-1 ring-inset ring-ink-700">
              <Hourglass className="h-3 w-3 text-gold-500" aria-hidden />
              {event.waitlist_count} waiting
            </span>
          )}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-gold-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          View details &amp; book
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </p>
      </div>
    </Link>
  );
}
