import { Link } from "react-router-dom";
import { Ticket } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

/**
 * Top nav shared by the public attendee pages (events, detail,
 * bookings, profile). Shows attendee links once signed in and a
 * sign in shortcut otherwise; admins use /admin dashy slashy.
 */
export function AppNav() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-40 border-b border-ink-800/60 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-ink-950">
            <Ticket className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-cream-50">
            EMS
          </span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2.5">
            <Link
              to="/bookings"
              className="rounded-lg border border-ink-700 px-3.5 py-2 text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
            >
              My bookings
            </Link>
            <Link
              to="/profile"
              className="hidden items-center gap-2 rounded-lg border border-ink-700 px-3.5 py-2 text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100 sm:flex"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-500/15 font-display text-[10px] font-semibold text-gold-300">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[140px] truncate">{user.name}</span>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-cream-500 transition hover:text-rose-300"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm font-medium text-cream-300 transition hover:border-gold-500/40 hover:text-cream-100"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
