import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AppShell } from "@/components/AppShell";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { CommandMenu } from "@/components/CommandMenu";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HireFlow",
  description: "Candidate pipeline management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${mono.variable}`}>
      <body className="flex h-screen overflow-hidden bg-bg">
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <ToastContainer />
          <CommandMenu />
        </AuthProvider>
      </body>
    </html>
  );
}
