import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "BGR Brain — Proje, Bütçe ve Lisans Yönetimi",
  description: "Endüstri 4.0 ekibi için iç yönetim uygulaması",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider
            user={
              session
                ? {
                    sub: session.sub,
                    email: session.email,
                    name: session.name,
                    role: session.role,
                  }
                : null
            }
          >
            <AppShell authed={!!session}>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
