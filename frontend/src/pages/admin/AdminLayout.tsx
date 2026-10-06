import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { Ticket } from "lucide-react";
import { EASE } from "../../lib/anim";

const TABS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/events", label: "Events", icon: CalendarDays, end: false },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function onSignOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-ink-950 text-cream-100">
      <header className="sticky top-0 z-40 border-b border-ink-800/60 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <NavLink to="/admin" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-ink-950">
                <Ticket className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-cream-50">
                EMS
                <span className="ml-2 rounded-md bg-ink-800 px-1.5 py-0.5 align-middle text-[10px] font-sans font-semibold uppercase tracking-wider text-gold-300">
                  Admin
                </span>
              </span>
            </NavLink>

            <nav className="flex items-center gap-1" aria-label="Admin sections">
              {TABS.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end={tab.end} className="relative">
                  {({ isActive }) => (
                    <span
                      className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                        isActive ? "text-cream-50" : "text-cream-500 hover:text-cream-300"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="admin-tab-bg"
                          transition={{ duration: 0.3, ease: EASE }}
                          className="absolute inset-0 rounded-lg bg-ink-800 ring-1 ring-inset ring-ink-700"
                        />
                      )}
                      <tab.icon className="relative h-4 w-4" aria-hidden />
                      <span className="relative hidden sm:inline">{tab.label}</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 rounded-full border border-ink-700 bg-ink-900 py-1.5 pr-3.5 pl-1.5 sm:flex">
              <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-gold-500/15 font-display text-xs font-semibold text-gold-300">
                {user?.name.charAt(0).toUpperCase() ?? "?"}
              </span>
              <span className="max-w-[160px] truncate text-xs font-medium text-cream-300">
                {user?.name}
              </span>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-lg border border-ink-700 p-2 text-cream-500 transition hover:border-rose-400/40 hover:text-rose-300"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
      >
        <Outlet />
      </motion.main>
    </div>
  );
}
