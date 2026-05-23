"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

interface Props {
  screen?: string;
  permission?: "read" | "write" | "create" | "edit" | "delete";
  children: React.ReactNode;
}

export function ProtectedRoute({ screen, permission = "read", children }: Props) {
  const { loading, authReady, user, hasPermission, permissionsLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authReady && !user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [authReady, user, router, pathname]);

  if (loading || !authReady) {
    return (
      <div className="flex h-screen items-center justify-center text-muted">
        Loading...
      </div>
    );
  }
  if (!user) return null;

  if (screen && permissionsLoaded && !hasPermission(screen, permission)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 p-12 text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted">You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
