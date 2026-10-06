/** Display helpers shared across pages. */

/** Parse a YYYY-MM-DD string as a *local* date (avoids UTC). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function dateParts(iso: string): {
  day: string;
  month: string;
  weekday: string;
  short: string;
  long: string;
} {
  const d = parseDate(iso);
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS[d.getMonth()] ?? "",
    weekday: WEEKDAYS[d.getDay()] ?? "",
    short: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
    long: d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = (h ?? 0) >= 12 ? "PM" : "AM";
  const hour12 = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

export function timeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function daysUntil(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((parseDate(iso).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return "Yesterday";
  return `${Math.abs(diff)} days ago`;
}

/**
 * The backend's payment hook encodes a flat fee in the venue field as
 * "paid:49.99". Presented as a price instead of raw text.
 */
export function parseVenue(venue: string): { venue: string; price: number | null } {
  const match = /^paid:(\d+(?:\.\d+)?)$/i.exec(venue.trim());
  if (match) return { venue: "Paid entry", price: Number(match[1]) };
  return { venue, price: null };
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
