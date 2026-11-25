"use server";

import { sql } from "@/lib/db";
import { CODE_LENGTH, normalizeCode } from "@/lib/format";
import { deviceVotedEpoch, getIpHash, voteToken } from "@/lib/voter";

type Fail = { ok: false; error: string };

export async function checkCode(
  pollId: string,
  raw: string,
): Promise<{ ok: true } | Fail> {
  const code = normalizeCode(raw);
  if (code.length !== CODE_LENGTH) return { ok: false, error: "Enter the full 8 character code." };

  const rows = (await sql()`
    SELECT used FROM codes WHERE code = ${code} AND poll_id = ${pollId}
  `) as { used: boolean }[];

  if (!rows[0]) return { ok: false, error: "This code is not valid for this poll." };
  if (rows[0].used) return { ok: false, error: "This code has already been used." };
  return { ok: true };
}

const MESSAGES: Record<string, string> = {
  not_found: "This poll no longer exists.",
  closed: "Voting for this poll is closed.",
  bad_candidate: "That name is not part of this poll.",
  bad_code: "This code is not valid or has already been used.",
  ip_used: "A vote has already been cast from this network.",
  device_used: "You have already voted on this device.",
};

export async function castVote(
  pollId: string,
  candidateId: number,
  rawCode: string | null,
): Promise<{ ok: true; token: string } | Fail> {
  if (typeof pollId !== "string" || !Number.isInteger(candidateId)) {
    return { ok: false, error: "Invalid request." };
  }
  const code = rawCode ? normalizeCode(rawCode) : null;
  const ipHash = await getIpHash(pollId);
  const deviceEpoch = await deviceVotedEpoch(pollId);
  let epoch: number;

  try {
    // Single atomic call. See cast_vote in src/lib/db.ts.
    const rows = (await sql()`
      SELECT cast_vote(${pollId}, ${candidateId}, ${code}, ${ipHash}, ${deviceEpoch}::int) AS epoch
    `) as { epoch: number }[];
    epoch = rows[0].epoch;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const key = msg.match(/VOTE:(\w+)/)?.[1];
    return { ok: false, error: (key && MESSAGES[key]) || "Something went wrong. Try again." };
  }

  // The browser stores this signed "voted" marker itself (see VoteFlow), so the page
  // isn't re-rendered before it moves to the leaderboard.
  return { ok: true, token: voteToken(pollId, epoch) };
}
