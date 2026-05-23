"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLogin = pathname === "/login";

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
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
