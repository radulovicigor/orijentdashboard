import { NextResponse } from "next/server";
import { COOKIE, authHash } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "").trim();
  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  const base = new URL(req.url);
  if (!expected || password !== expected) {
    return NextResponse.redirect(new URL("/login?e=1", base), 303);
  }
  const res = NextResponse.redirect(new URL("/", base), 303);
  res.cookies.set(COOKIE, await authHash(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
