"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLogin = pathname === "/login";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && !isLogin) {
      router.replace("/login");
    }
  }, [loading, user, isLogin, router]);

  if (isLogin) {
    return <div className="flex-1 min-w-0">{children}</div>;
  }

  if (loading || !user) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center bg-bg">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar — hidden below lg */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-card w-72 h-full shadow-xl flex flex-col overflow-hidden">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar onMobileMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
