/** Typed API client matching the backend*/

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type EventStatus = "draft" | "scheduled" | "completed" | "cancelled";

export const EVENT_STATUSES: EventStatus[] = ["draft", "scheduled", "completed", "cancelled"];

/** Shape of `EventOut` from the backend. */
export interface EventOut {
  id: number;
  admin_id: number;
  event_name: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  venue: string;
  capacity: number;
  status: EventStatus;
}

/** Shape of `EventWithCounts` (GET /api/events/{id}). */
export interface EventWithCounts extends EventOut {
  confirmed_bookings: number;
  waitlist_count: number;
}

/** Shape of `UserOut`. */
export interface UserOut {
  id: number;
  name: string;
  email: string;
  contact_no: string | null;
  registration_date: string;
  status: string;
  is_admin: boolean;
}

/** Shape of the login `Token` response. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

/** Shape of `RegistrationOut` (a booking). */
export interface RegistrationOut {
  id: number;
  user_id: number;
  event_id: number;
  booking_date: string;
  status: string;
}

/** Shape of `WaitlistOut`. */
export interface WaitlistOut {
  id: number;
  user_id: number;
  event_id: number;
  position: number;
  joined_date: string;
  status: string;
}

/** Shape of `PaymentOut`. `amount` may arrive as a number or a decimal string. */
export interface PaymentOut {
  id: number;
  registration_id: number;
  amount: number | string;
  payment_date: string | null;
  status: string;
  transaction_id: string | null;
}

/** POST /api/registrations response: booked (with optional payment receipt) or waitlisted. */
export type BookingResult =
  | {
      result: "booked";
      registration: RegistrationOut;
      payment: PaymentOut | null;
    }
  | {
      result: "waitlisted";
      waitlist: WaitlistOut;
      payment: null;
    };

/** Body for POST /api/auth/register (matches `UserCreate`). */
export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
}

/** Body for PUT /api/users/{id} (matches `UserUpdate`). */
export interface UserUpdatePayload {
  name?: string;
  phone?: string | null;
  password?: string;
}

/** Shape of `ReportOut` (admin reports). */
export interface ReportOut {
  id: number;
  admin_id: number;
  report_type: string;
  generated_date: string;
  report_data: {
    total_events?: number;
    events_by_status?: Record<string, number>;
    total_capacity?: number;
    total_registrations?: number;
    registrations_by_status?: Record<string, number>;
    revenue?: number;
  };
}

/** Body for POST /api/events (matches `EventCreate`). */
export interface EventPayload {
  event_name: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  capacity: number;
  status: EventStatus;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function extractDetail(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string; loc?: unknown[] };
      const field =
        Array.isArray(first.loc) && first.loc.length > 1 ? String(first.loc[1]) : "";
      const msg = String(first.msg ?? "Invalid input").replace(/^Value error,\s*/i, "");
      return field ? `${field}: ${msg}` : msg;
    }
  }
  return "Request failed";
}

//auth store

const AUTH_STORE_KEY = "ems.auth";
export const AUTH_EXPIRED_EVENT = "ems:auth-expired";

export interface StoredAuth {
  token: string;
  user: UserOut;
}

export function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed.token && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

export function storeAuth(auth: StoredAuth | null): void {
  if (auth) localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(auth));
  else localStorage.removeItem(AUTH_STORE_KEY);
}

//requests

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Explicit bearer token (used right after login, before it is stored). */
  authToken?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.authToken ?? readStoredAuth()?.token;
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, "Could not reach the server — is the API running?");
  }

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw new ApiError(res.status, extractDetail(data));
  }
  return data as T;
}

export const api = {
  // auth 
  register: (payload: UserCreatePayload) =>
    request<UserOut>("/api/auth/register", { method: "POST", body: payload }),
  login: (email: string, password: string) =>
    request<TokenResponse>("/api/auth/login", { method: "POST", body: { email, password } }),
  getUser: (id: number, authToken?: string) =>
    request<UserOut>(`/api/users/${id}`, { authToken }),
  updateUser: (id: number, payload: UserUpdatePayload) =>
    request<UserOut>(`/api/users/${id}`, { method: "PUT", body: payload }),

  // attendee bookings 
  createRegistration: (eventId: number) =>
    request<BookingResult>("/api/registrations", {
      method: "POST",
      body: { event_id: eventId },
    }),
  listMyRegistrations: (userId: number) =>
    request<RegistrationOut[]>(`/api/users/${userId}/registrations`),
  cancelRegistration: (registrationId: number) =>
    request<RegistrationOut>(`/api/registrations/${registrationId}`, {
      method: "DELETE",
    }),
  listMyWaitlist: () => request<WaitlistOut[]>("/api/waitlist/mine"),
  leaveWaitlist: (entryId: number) =>
    request<WaitlistOut>(`/api/waitlist/${entryId}`, { method: "DELETE" }),
  getPayment: (paymentId: number) =>
    request<PaymentOut>(`/api/payments/${paymentId}`),

  //events (public reads, admin-guarded writes) 
  /** List events; the API includes live booking/waitlist counts in one request. */
  listEvents: (statusFilter?: EventStatus) =>
    request<EventWithCounts[]>(
      statusFilter ? `/api/events?status_filter=${statusFilter}` : "/api/events",
    ),
  getEvent: (id: number) => request<EventWithCounts>(`/api/events/${id}`),
  createEvent: (payload: EventPayload) =>
    request<EventOut>("/api/events", { method: "POST", body: payload }),
  updateEvent: (id: number, payload: Partial<EventPayload>) =>
    request<EventOut>(`/api/events/${id}`, { method: "PUT", body: payload }),
  deleteEvent: (id: number) => request<void>(`/api/events/${id}`, { method: "DELETE" }),

  // reports (admin) 
  eventReport: () => request<ReportOut>("/api/reports/events"),
  registrationReport: () => request<ReportOut>("/api/reports/registrations"),
};
