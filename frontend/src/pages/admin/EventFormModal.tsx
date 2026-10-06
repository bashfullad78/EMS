import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, EVENT_STATUSES, type EventOut, type EventStatus } from "../../lib/api";
import { Field, inputClass, Spinner } from "../../components/ui";
import { Modal } from "../../components/Modal";

interface FormState {
  event_name: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  capacity: string;
  status: EventStatus;
}

const EMPTY: FormState = {
  event_name: "",
  description: "",
  event_date: "",
  start_time: "",
  end_time: "",
  venue: "",
  capacity: "",
  status: "scheduled",
};

function toFormState(event: EventOut | null): FormState {
  if (!event) return EMPTY;
  return {
    event_name: event.event_name,
    description: event.description ?? "",
    event_date: event.event_date,
    start_time: event.start_time.slice(0, 5),
    end_time: event.end_time.slice(0, 5),
    venue: event.venue,
    capacity: String(event.capacity),
    status: event.status,
  };
}

interface Props {
  open: boolean;
  initial: EventOut | null;
  onClose: () => void;
  onSaved: (saved: EventOut, mode: "created" | "updated") => void;
}

/** Create/edit dialog mapped 1:1 onto the backend's EventCreate/EventUpdate schemas. */
export function EventFormModal({ open, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(initial));
      setErrors({});
      setServerError(null);
      setBusy(false);
    }
  }, [open, initial]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.event_name.trim()) next.event_name = "Event name is required";
    if (!form.event_date) next.event_date = "Date is required";
    if (!form.start_time) next.start_time = "Start time is required";
    if (!form.end_time) next.end_time = "End time is required";
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      next.end_time = "End time must be after the start time";
    }
    if (!form.venue.trim()) next.venue = "Venue is required";
    const capacity = Number(form.capacity);
    if (!form.capacity || !Number.isInteger(capacity) || capacity < 1) {
      next.capacity = "Capacity must be a whole number of at least 1";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    if (!validate()) return;

    setBusy(true);
    const payload = {
      event_name: form.event_name.trim(),
      description: form.description.trim() || null,
      event_date: form.event_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue: form.venue.trim(),
      capacity: Number(form.capacity),
      status: form.status,
    };
    try {
      const saved =
        initial === null
          ? await api.createEvent(payload)
          : await api.updateEvent(initial.id, payload);
      onSaved(saved, initial === null ? "created" : "updated");
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial === null ? "Create event" : "Edit event"}
      description={
        initial === null
          ? "Fill in the details — it goes live on the public page immediately."
          : `Updating “${initial.event_name}”.`
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Event name" required error={errors.event_name}>
          <input
            type="text"
            value={form.event_name}
            onChange={(e) => set("event_name", e.target.value)}
            placeholder="e.g. Python Conf 2026"
            maxLength={200}
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field
          label="Description"
          hint="Optional — a sentence or two about the event."
        >
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What should attendees expect?"
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" required error={errors.event_date}>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => set("event_date", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Starts" required error={errors.start_time}>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Ends" required error={errors.end_time}>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => set("end_time", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Venue" required error={errors.venue}>
              <input
                type="text"
                value={form.venue}
                onChange={(e) => set("venue", e.target.value)}
                placeholder="e.g. Grand Hall, Tech Park"
                maxLength={300}
                className={inputClass}
              />
            </Field>
          </div>
          <Field
            label="Capacity"
            required
            error={errors.capacity}
            hint={initial ? "Can't go below confirmed bookings" : undefined}
          >
            <input
              type="number"
              min={1}
              step={1}
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="30"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Status">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EVENT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status", s)}
                className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                  form.status === s
                    ? "bg-gold-500/15 text-gold-300 ring-1 ring-inset ring-gold-500/40"
                    : "bg-ink-850 text-cream-500 ring-1 ring-inset ring-ink-700 hover:text-cream-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {serverError && (
          <p
            role="alert"
            className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
          >
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-ink-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink-700 px-4 py-2.5 text-sm font-medium text-cream-300 transition hover:border-ink-600 hover:text-cream-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Spinner /> Saving…
              </>
            ) : initial === null ? (
              "Create event"
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
