import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarPlus,
  Clock,
  MapPin,
  Pencil,
  Search,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  api,
  errorMessage,
  EVENT_STATUSES,
  type EventOut,
  type EventStatus,
  type EventWithCounts,
} from "../../lib/api";
import { dateParts, daysUntil, formatMoney, parseVenue, timeRange } from "../../lib/format";
import { CapacityMeter, StatusPill } from "../../components/ui";
import { Modal } from "../../components/Modal";
import { EventFormModal } from "./EventFormModal";
import { useToast } from "../../components/Toast";
import { EASE } from "../../lib/anim";

type Filter = "all" | EventStatus;

export default function EventsManager() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<EventOut[] | null>(null);
  const [counts, setCounts] = useState<Record<number, EventWithCounts>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventOut | null>(null);
  const [deleting, setDeleting] = useState<EventOut | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The list endpoint includes live booking/waitlist counts.
      const list = await api.listEvents();
      setEvents(list);
      const map: Record<number, EventWithCounts> = {};
      for (const e of list) map[e.id] = e;
      setCounts(map);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Dashboard's "New event" shortcut 
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(null);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    if (!events) return [];
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "all" && e.status !== filter) return false;
      if (!q) return true;
      return (
        e.event_name.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q)
      );
    });
  }, [events, filter, query]);

  const tabCounts = useMemo(() => {
    const map: Record<Filter, number> = { all: 0, draft: 0, scheduled: 0, completed: 0, cancelled: 0 };
    for (const e of events ?? []) {
      map.all += 1;
      map[e.status] = (map[e.status] ?? 0) + 1;
    }
    return map;
  }, [events]);

  function onSaved(saved: EventOut, mode: "created" | "updated") {
    setEvents((list) => {
      if (!list) return [saved];
      return mode === "created"
        ? [...list, saved].sort((a, b) => a.event_date.localeCompare(b.event_date))
        : list.map((e) => (e.id === saved.id ? saved : e));
    });
    setCounts((c) => ({
      ...c,
      [saved.id]: { ...saved, confirmed_bookings: c[saved.id]?.confirmed_bookings ?? 0, waitlist_count: c[saved.id]?.waitlist_count ?? 0 },
    }));
    setFormOpen(false);
    setEditing(null);
    toast("success", mode === "created" ? `Created "${saved.event_name}"` : `Updated "${saved.event_name}"`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteEvent(deleting.id);
      const name = deleting.event_name;
      setEvents((list) => list?.filter((e) => e.id !== deleting.id) ?? null);
      setCounts((c) => {
        const next = { ...c };
        delete next[deleting.id];
        return next;
      });
      setDeleting(null);
      toast("success", `Deleted "${name}"`);
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-cream-50 sm:text-4xl">Events</h1>
          <p className="mt-1.5 text-sm text-cream-500">
            Create, update and retire events. Capacity can't drop below confirmed bookings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_10px_28px_-12px_rgba(221,167,55,0.55)] transition hover:-translate-y-0.5 hover:bg-gold-400"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          New event
        </button>
      </div>

      {/* toolbar */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Filter by status"
          className="flex flex-wrap gap-1.5 rounded-xl border border-ink-800 bg-ink-900 p-1.5"
        >
          {(["all", ...EVENT_STATUSES] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-ink-800 text-cream-50 ring-1 ring-inset ring-ink-700"
                  : "text-cream-500 hover:text-cream-300"
              }`}
            >
              {f}
              <span className="ml-1.5 text-[10px] text-cream-600">{tabCounts[f]}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cream-600"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, venue…"
            aria-label="Search events"
            className="w-full rounded-xl border border-ink-800 bg-ink-900 py-2.5 pr-3 pl-9.5 text-sm text-cream-100 placeholder:text-cream-600 outline-none transition focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/15"
          />
        </div>
      </div>

      {/* error */}
      {error && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-ink-700 bg-ink-900 px-6 py-14 text-center">
          <WifiOff className="h-8 w-8 text-cream-600" aria-hidden />
          <div>
            <p className="font-medium text-cream-100">Couldn't load events</p>
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
      )}

      {/* loading */}
      {loading && !error && (
        <div className="mt-6 space-y-3" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-ink-800 bg-ink-900/60" />
          ))}
        </div>
      )}

      {/* list */}
      {!loading && !error && filtered.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-700 bg-ink-900/50 px-6 py-16 text-center">
          <CalendarPlus className="mx-auto h-8 w-8 text-cream-600" aria-hidden />
          <p className="mt-4 font-medium text-cream-100">
            {events && events.length > 0 ? "No events match your filters" : "No events yet"}
          </p>
          <p className="mt-1 text-sm text-cream-500">
            {events && events.length > 0
              ? "Try a different status or clear the search."
              : "Create your first event to get started."}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((event) => (
              <motion.li
                key={event.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <EventRow
                  event={event}
                  detail={counts[event.id]}
                  onEdit={() => {
                    setEditing(event);
                    setFormOpen(true);
                  }}
                  onDelete={() => setDeleting(event)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* create / edit */}
      <EventFormModal
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={onSaved}
      />

      {/* delete confirm */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete event"
        description="This action can't be undone."
      >
        <p className="text-sm leading-relaxed text-cream-300">
          You're about to permanently delete{" "}
          <span className="font-semibold text-cream-50">“{deleting?.event_name}”</span> along with
          its registrations and waitlist entries.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setDeleting(null)}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm font-medium text-cream-300 transition hover:border-ink-600 hover:text-cream-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            disabled={deleteBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            {deleteBusy ? "Deleting…" : "Delete event"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// row

function EventRow({
  event,
  detail,
  onEdit,
  onDelete,
}: {
  event: EventOut;
  detail?: EventWithCounts;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const d = dateParts(event.event_date);
  const { venue, price } = parseVenue(event.venue);
  const confirmed = detail?.confirmed_bookings ?? 0;
  const waitlisted = detail?.waitlist_count ?? 0;

  return (
    <div
      onClick={onEdit}
      className="group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 rounded-2xl border border-ink-800 bg-ink-900 p-4 transition hover:border-gold-500/30 hover:bg-ink-850/70 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_150px_auto] sm:gap-x-6"
    >
      {/* date chip */}
      <div className="w-13 rounded-xl border border-ink-700 bg-ink-850 px-2.5 py-2 text-center">
        <p className="font-display text-lg font-semibold leading-none text-gold-400">{d.day}</p>
        <p className="mt-1 text-[9px] font-bold tracking-widest text-cream-500">{d.month}</p>
      </div>

      {/* name + meta */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-base text-cream-50">{event.event_name}</h3>
          <StatusPill status={event.status} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-cream-500">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{venue}</span>
          {price !== null && (
            <span className="shrink-0 rounded bg-gold-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold-300">
              {formatMoney(price)}
            </span>
          )}
          <span className="text-cream-700">·</span>
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          <span className="shrink-0">{timeRange(event.start_time, event.end_time)}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-cream-600">{daysUntil(event.event_date)}</p>
      </div>

      {/* capacity */}
      <div className="col-span-3 sm:col-span-1">
        <CapacityMeter confirmed={confirmed} capacity={event.capacity} />
      </div>

      {/* waitlist chip */}
      <div className="hidden sm:block">
        {waitlisted > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-850 px-2.5 py-1 text-[11px] text-cream-500 ring-1 ring-inset ring-ink-700">
            {waitlisted} waiting
          </span>
        ) : (
          <span className="text-[11px] text-cream-700">—</span>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Edit ${event.event_name}`}
          title="Edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded-lg p-2 text-cream-500 transition hover:bg-ink-800 hover:text-gold-300"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Delete ${event.event_name}`}
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg p-2 text-cream-500 transition hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
