import "server-only";
import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ipHasVoted } from "./db";

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
  return createHmac("sha256", secret()).update(`${pollId}|${ip}`).digest("hex");
}

const secret = () => process.env.IP_SALT || process.env.ADMIN_PASSWORD || "anonymous-vote";

export const cookieName = (pollId: string) => `voted_${pollId}`;

/**
 * The device marker is "<round>.<signature>". The signature is made with a server
 * secret, so it can't be forged from the browser console to unlock the leaderboard.
 * It says nothing about who was chosen.
 */
export function voteToken(pollId: string, epoch: number) {
  const sig = createHmac("sha256", secret()).update(`vote|${pollId}|${epoch}`).digest("base64url");
  return `${epoch}.${sig.slice(0, 32)}`;
}

/** The reset round this device voted in (only if its marker is genuine), or null. */
export async function deviceVotedEpoch(pollId: string) {
  const value = (await cookies()).get(cookieName(pollId))?.value;
  if (!value) return null;
  const epoch = Number(value.split(".")[0]);
  if (!Number.isInteger(epoch)) return null;
  const expected = Buffer.from(voteToken(pollId, epoch));
  const given = Buffer.from(value);
  return given.length === expected.length && timingSafeEqual(given, expected) ? epoch : null;
}

/**
 * Has this viewer voted in the current round?
 * - A genuine device marker always counts (it also covers phones whose IP
 *   changes on mobile data).
 * - The network's IP hash counts only when the poll's IP limit is on. When it is
 *   off (e.g. a whole campus shares one IP), one person's vote must not unlock
 *   the leaderboard for everyone else on the same Wi-Fi.
 */
export async function viewerHasVoted(pollId: string, epoch: number, onePerIp: boolean) {
  if ((await deviceVotedEpoch(pollId)) === epoch) return true;
  if (!onePerIp) return false;
  return ipHasVoted(pollId, await getIpHash(pollId));
}
