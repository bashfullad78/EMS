import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";

/** Anon visitors go to /login */
export function RequireAdmin() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.is_admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 p-6 text-cream-100">
        <div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/10 ring-1 ring-inset ring-gold-500/30">
            <ShieldAlert className="h-6 w-6 text-gold-400" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl tracking-tight text-cream-50">
            Admin access only
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-cream-500">
            You're signed in as <span className="text-cream-300">{user.email}</span>. This account
            doesn't have administrative privileges.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/login"
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
            >
              Switch account
            </Link>
            <Link
              to="/"
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-cream-300 transition hover:border-ink-600 hover:text-cream-100"
            >
              Back to events
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <Outlet />;
}
