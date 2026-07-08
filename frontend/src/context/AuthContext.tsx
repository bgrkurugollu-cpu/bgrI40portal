"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type SessionUser = {
  sub: string;
  email: string;
  name: string;
  role: string;
};

const AuthContext = createContext<{
  user: SessionUser | null;
  logout: () => Promise<void>;
}>({ user: null, logout: async () => {} });

export function AuthProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: ReactNode;
}) {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
