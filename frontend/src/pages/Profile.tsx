import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarDays,
  KeyRound,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { AppNav } from "../components/AppNav";
import { Field, inputClass, Spinner } from "../components/ui";
import { Reveal } from "../components/Reveal";
import { errorMessage, type UserUpdatePayload } from "../lib/api";
import { EASE } from "../lib/anim";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.contact_no ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  // Narrowed alias: the guard above guarantees a session (RequireAuth),
  // and function declarations are hoisted so TS can't narrow inside.
  const account = user;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setError("Name can't be empty.");
      return;
    }
    if (password && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    const payload: UserUpdatePayload = {};
    if (trimmedName !== account.name) payload.name = trimmedName;
    // An omitted phone keeps the current one (the API treats null as
    // "no change"), so only send it when it was actually edited.
    if (trimmedPhone && trimmedPhone !== (account.contact_no ?? "")) {
      payload.phone = trimmedPhone;
    }
    if (password) payload.password = password;

    if (Object.keys(payload).length === 0) {
      toast("info", "No changes to save.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateProfile(payload);
      setPassword("");
      setConfirm("");
      toast("success", "Profile updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const memberSince = new Date(user.registration_date).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );

  return (
    <div className="min-h-screen bg-ink-950 text-cream-100">
      <AppNav />

      <main className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
            Attendee
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-cream-50 sm:text-4xl">
            Profile
          </h1>
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/*account card */}
          <Reveal delay={80}>
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 font-display text-2xl font-semibold text-gold-300 ring-1 ring-inset ring-gold-500/25">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-display text-xl tracking-tight text-cream-50">
                    {user.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-cream-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                      {user.status}
                    </span>
                    {user.is_admin && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/10 px-2 py-0.5 font-medium text-gold-300 ring-1 ring-inset ring-gold-500/25">
                        <ShieldCheck className="h-3 w-3" aria-hidden />
                        Admin
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <dl className="mt-6 space-y-3.5 border-t border-ink-800 pt-5 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                  <dt className="w-20 shrink-0 text-cream-600">Email</dt>
                  <dd className="truncate text-cream-200">{user.email}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 shrink-0 text-gold-600" aria-hidden />
                  <dt className="w-20 shrink-0 text-cream-600">Phone</dt>
                  <dd className="text-cream-200">
                    {user.contact_no || "—"}
                  </dd>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDays
                    className="h-4 w-4 shrink-0 text-gold-600"
                    aria-hidden
                  />
                  <dt className="w-20 shrink-0 text-cream-600">Member</dt>
                  <dd className="text-cream-200">since {memberSince}</dd>
                </div>
              </dl>
            </div>
          </Reveal>

          {/* edit form */}
          <Reveal delay={160}>
            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="rounded-2xl border border-ink-700 bg-ink-900 p-6"
              noValidate
            >
              <h2 className="font-display text-xl tracking-tight text-cream-50">
                Edit profile
              </h2>
              <p className="mt-1 text-sm text-cream-500">
                Update how your name and contact appear across EMS.
              </p>

              <div className="mt-6 space-y-4">
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
                      autoComplete="name"
                      required
                      minLength={1}
                      maxLength={120}
                      className={`${inputClass} pl-9.5`}
                    />
                  </div>
                </Field>

                <Field
                  label="Phone"
                  hint="Leave blank to keep your current number."
                >
                  <div className="relative">
                    <Phone
                      className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-cream-600"
                      aria-hidden
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      maxLength={40}
                      className={`${inputClass} pl-9.5`}
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-7 border-t border-ink-800 pt-6">
                <h3 className="flex items-center gap-2 font-display text-lg tracking-tight text-cream-50">
                  <KeyRound className="h-4 w-4 text-gold-500" aria-hidden />
                  Change password
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="New password" hint="At least 8 characters.">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Confirm password">
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Spinner /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden />
                    Save changes
                  </>
                )}
              </button>
            </motion.form>
          </Reveal>
        </div>

        <Reveal delay={240} className="mt-6">
          <p className="flex items-center gap-2 text-xs text-cream-600">
            <BadgeCheck className="h-3.5 w-3.5 text-gold-600" aria-hidden />
            Your bookings are tied to this account's email address.
          </p>
        </Reveal>
      </main>
    </div>
  );
}
