"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Permission = {
  role: string;
  screenName: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canWrite: boolean;
};

type Me = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  roles: string[];
  isSuperadmin: boolean;
  permissions: Permission[];
};

type PermMap = Map<string, Map<string, Map<string, boolean>>>;

interface AuthState {
  user: (Omit<Me, "roles" | "permissions"> & { isSuperadmin: boolean }) | null;
  userRoles: string[];
  rolePermissions: PermMap;
  permissionsLoaded: boolean;
  loading: boolean;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (screen: string, perm: "read" | "write" | "create" | "edit" | "delete") => boolean;
  refreshPermissions: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
};

function buildPermissionMap(perms: Permission[]): PermMap {
  const map: PermMap = new Map();
  for (const p of perms) {
    if (!map.has(p.role)) map.set(p.role, new Map());
    const inner = map.get(p.role)!;
    const m = new Map<string, boolean>();
    m.set("read", p.canRead);
    m.set("create", p.canCreate);
    m.set("edit", p.canEdit);
    m.set("delete", p.canDelete);
    m.set("write", p.canCreate || p.canEdit);
    inner.set(p.screenName, m);
  }
  return map;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<PermMap>(new Map());
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/auth/me", { credentials: "include" });
    if (!r.ok) throw new Error("me failed");
    const me: Me = await r.json();
    setUser({
      id: me.id,
      email: me.email,
      fullName: me.fullName,
      avatarUrl: me.avatarUrl,
      phone: me.phone,
      isSuperadmin: me.isSuperadmin,
    });
    setUserRoles(me.roles);
    setRolePermissions(buildPermissionMap(me.permissions));
    setPermissionsLoaded(true);
  }, []);

  const signOut = useCallback(async () => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    sseRef.current?.close();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setUser(null);
    setUserRoles([]);
    setRolePermissions(new Map());
    setPermissionsLoaded(false);
  }, []);

  const startRefreshTimer = useCallback(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = window.setInterval(async () => {
      const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!r.ok) await signOut();
    }, 14 * 60 * 1000);
  }, [signOut]);

  const openSSE = useCallback(
    (meId: string) => {
      sseRef.current?.close();
      const es = new EventSource("/api/realtime/role-permissions", { withCredentials: true });
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "role-updated") loadMe();
          if (data.type === "user-role-assigned" && data.userId === meId) loadMe();
        } catch {
          // ignore parse errors
        }
      };
      es.onerror = () => {
        // Auto-reconnect handled by browser
      };
      sseRef.current = es;
    },
    [loadMe],
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (r.ok) {
          await loadMe();
          startRefreshTimer();
        }
      } catch {
        // Not authenticated — stay on loading=false, user=null
      } finally {
        setLoading(false);
        setAuthReady(true);
      }
    })();
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      sseRef.current?.close();
    };
  }, [loadMe, startRefreshTimer]);

  useEffect(() => {
    if (user) openSSE(user.id);
  }, [user, openSSE]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: "Login failed" }));
        throw new Error(typeof error === "string" ? error : "Login failed");
      }
      await loadMe();
      startRefreshTimer();
    },
    [loadMe, startRefreshTimer],
  );

  const hasPermission = useCallback(
    (screen: string, perm: "read" | "write" | "create" | "edit" | "delete") => {
      if (!user) return false;
      if (user.isSuperadmin || userRoles.includes("admin")) return true;
      const parts = screen.split(".");
      for (let i = parts.length; i > 0; i--) {
        const key = parts.slice(0, i).join(".");
        for (const role of userRoles) {
          const m = rolePermissions.get(role)?.get(key);
          if (m?.get(perm)) return true;
        }
      }
      return false;
    },
    [user, userRoles, rolePermissions],
  );

  return (
    <Ctx.Provider
      value={{
        user,
        userRoles,
        rolePermissions,
        permissionsLoaded,
        loading,
        authReady,
        signIn,
        signOut,
        hasPermission,
        refreshPermissions: loadMe,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
