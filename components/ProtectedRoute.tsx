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
  const { loading, user, hasPermission, permissionsLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, user, router, pathname]);

  if (loading) {
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
