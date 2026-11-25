import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "admin_session";

function expectedToken() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD is not set. Add it to .env.local");
  return createHmac("sha256", pw).update("anonymous-vote-admin").digest("hex");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passwordMatches(input: string) {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  return pw.length > 0 && safeEqual(input, pw);
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && safeEqual(value, expectedToken());
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function setAdminCookie() {
  (await cookies()).set(COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(COOKIE);
}
