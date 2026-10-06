import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  readStoredAuth,
  storeAuth,
  AUTH_EXPIRED_EVENT,
  type UserOut,
  type UserUpdatePayload,
} from "../lib/api";

interface AuthValue {
  user: UserOut | null;
  /** Logs in via the backend and persists the session. Any active account may
   * sign in; admins routed to /admin, attendees to their bookings. */
  login: (email: string, password: string) => Promise<UserOut>;
  /** Updates the signed-in user's profile and refreshes the stored session. */
  updateProfile: (payload: UserUpdatePayload) => Promise<UserOut>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Extract the `sub` claim (user id) from the backend's HS256 JWT. */
function tokenSub(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { sub?: string };
    return payload.sub ? Number(payload.sub) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(() => readStoredAuth()?.user ?? null);

  // The API client fires this on unexpected 401 (expired token).
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password);
    const id = tokenSub(access_token);
    const me = await api.getUser(id ?? 0, access_token);
    storeAuth({ token: access_token, user: me });
    setUser(me);
    return me;
  }, []);

  const updateProfile = useCallback(
    async (payload: UserUpdatePayload) => {
      if (!user) throw new Error("Not signed in");
      const updated = await api.updateUser(user.id, payload);
      const stored = readStoredAuth();
      storeAuth(stored ? { ...stored, user: updated } : null);
      setUser(updated);
      return updated;
    },
    [user],
  );

  const logout = useCallback(() => {
    storeAuth(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, updateProfile, logout }),
    [user, login, updateProfile, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
