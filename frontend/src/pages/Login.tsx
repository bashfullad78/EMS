import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Ticket,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api, errorMessage, type UserOut } from "../lib/api";
import { Field, inputClass, Spinner } from "../components/ui";
import { EASE } from "../lib/anim";

/** Seeded demo credentials from `python -m app.seed`. */
const DEMO_ADMIN = { email: "admin@example.com", password: "admin-password" };
const DEMO_ATTENDEE = { email: "alice@example.com", password: "alice-password" };

type Mode = "signin" | "signup";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  // Already signed in? Straight to the right home for the account's role.
  if (user) {
    return <Navigate to={homeFor(user.is_admin, from)} replace />;
  }

  /** Admins land on the console (or their intended admin page); attendees on
   * their bookings (or the page they were headed to). */
  function homeFor(isAdmin: boolean, intended: string): string {
    if (isAdmin) return intended.startsWith("/admin") ? intended : "/admin";
    return intended.startsWith("/admin") ? "/bookings" : intended || "/bookings";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let me: UserOut;
      if (mode === "signup") {
        await api.register({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || null,
        });
        // Signed up — sign straight in so the attendee lands on their bookings.
        me = await login(email.trim(), password);
      } else {
        me = await login(email.trim(), password);
      }
      navigate(homeFor(me.is_admin, from), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-16 text-cream-100">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-gold-500/[0.08] blur-[120px]" />
      </div>

      <motion.div
        key={shake}
        initial={shake > 0 ? { x: 0 } : false}
        animate={shake > 0 ? { x: [0, -10, 10, -6, 6, -2, 0] } : undefined}
        transition={{ duration: 0.45, ease: EASE }}
        className="relative w-full max-w-md"
      >
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.8)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 text-ink-950">
              <Ticket className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-cream-50">
                EMS
              </p>
              <p className="text-xs text-cream-500">Event Management System</p>
            </div>
          </div>

          {/* mode toggle */}
          <div
            role="tablist"
            aria-label="Account actions"
            className="mt-7 grid grid-cols-2 gap-1 rounded-xl border border-ink-700 bg-ink-850 p-1"
          >
            {(
              [
                { id: "signin", label: "Sign in", icon: KeyRound },
                { id: "signup", label: "Create account", icon: UserPlus },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => {
                  setMode(tab.id);
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === tab.id
                    ? "bg-ink-800 text-cream-50 ring-1 ring-inset ring-ink-600"
                    : "text-cream-500 hover:text-cream-300"
                }`}
              >
                <tab.icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            ))}
          </div>

          <h1 className="mt-6 font-display text-2xl tracking-tight text-cream-50">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-cream-500">
            {mode === "signin"
              ? "Sign in to book seats and manage your bookings."
              : "Create an account, then book seats and join waitlists."}
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
            {mode === "signup" && (
              <Field label="Full name" required>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cream-600"
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sam Lee"
                    autoComplete="name"
                    required
                    minLength={1}
                    maxLength={120}
                    className={`${inputClass} pl-9.5`}
                  />
                </div>
              </Field>
            )}

            <Field label="Email" required>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cream-600"
                  aria-hidden
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className={`${inputClass} pl-9.5`}
                />
              </div>
            </Field>

            <Field
              label="Password"
              required
              hint={mode === "signup" ? "At least 8 characters." : undefined}
            >
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cream-600"
                  aria-hidden
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  maxLength={128}
                  className={`${inputClass} pl-9.5`}
                />
              </div>
            </Field>

            {mode === "signup" && (
              <Field label="Phone" hint="Optional — used for event notifications.">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1-555-0000"
                  autoComplete="tel"
                  maxLength={40}
                  className={inputClass}
                />
              </Field>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Spinner />{" "}
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                <>
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Create account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-ink-700 bg-ink-850/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cream-500">
              Demo access
            </p>
            <p className="mt-1 text-xs leading-relaxed text-cream-600">
              Seeded accounts — tap to fill:
            </p>
            <div className="mt-2.5 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setEmail(DEMO_ADMIN.email);
                  setPassword(DEMO_ADMIN.password);
                  setError(null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-gold-300 ring-1 ring-inset ring-ink-700 transition hover:ring-gold-500/40"
              >
                <span className="truncate">
                  {DEMO_ADMIN.email} / {DEMO_ADMIN.password}
                </span>
                <span className="shrink-0 rounded bg-ink-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream-500">
                  Admin
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setEmail(DEMO_ATTENDEE.email);
                  setPassword(DEMO_ATTENDEE.password);
                  setError(null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-gold-300 ring-1 ring-inset ring-ink-700 transition hover:ring-gold-500/40"
              >
                <span className="truncate">
                  {DEMO_ATTENDEE.email} / {DEMO_ATTENDEE.password}
                </span>
                <span className="shrink-0 rounded bg-ink-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream-500">
                  Attendee
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        <div className="mt-5 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-cream-500 transition hover:text-cream-300"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to events
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
