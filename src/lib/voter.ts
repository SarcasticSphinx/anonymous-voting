import "server-only";
import { cookies, headers } from "next/headers";
import { createHmac } from "node:crypto";

/*
  The raw IP is never stored. We keep an HMAC of (poll id + IP) using a server
  secret, so the same IP gives a different hash in every poll and the hash
  cannot be reversed or matched against a list of IPs without the secret.
*/
export async function getIpHash(pollId: string) {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    "unknown";
  const secret = process.env.IP_SALT || process.env.ADMIN_PASSWORD || "anonymous-vote";
  return createHmac("sha256", secret).update(`${pollId}|${ip}`).digest("hex");
}

export const cookieName = (pollId: string) => `voted_${pollId}`;

/** Returns the reset round this device last voted in, or null. */
export async function deviceVotedEpoch(pollId: string) {
  const v = (await cookies()).get(cookieName(pollId))?.value;
  const n = v == null ? NaN : Number(v);
  return Number.isInteger(n) ? n : null;
}
