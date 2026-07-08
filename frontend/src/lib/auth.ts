import { cookies } from "next/headers";
import { verifySession, AUTH_COOKIE } from "@/lib/session";

export { AUTH_COOKIE } from "@/lib/session";
export type { SessionPayload } from "@/lib/session";
export { signSession, verifySession } from "@/lib/session";

export async function getSession() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
