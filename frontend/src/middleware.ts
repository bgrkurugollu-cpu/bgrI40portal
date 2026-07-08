import { NextResponse, type NextRequest } from "next/server";
import { verifySession, AUTH_COOKIE } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth");
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  // /admin yalnızca ADMIN rolüne açık
  if (session && pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
