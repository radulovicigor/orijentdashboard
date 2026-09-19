import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, authHash } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const pw = process.env.DASHBOARD_PASSWORD?.trim();
  if (!pw) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) return NextResponse.next();
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && cookie === (await authHash(pw))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"],
};
