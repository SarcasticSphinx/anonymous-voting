"use server";

import { refresh } from "next/cache";
import { ensureSchema, sql, type PollSummary } from "@/lib/db";
import { clearAdminCookie, passwordMatches, requireAdmin, setAdminCookie } from "@/lib/auth";
import { generateCode, newPollId } from "@/lib/codes";

export async function login(password: string) {
  if (!passwordMatches(password)) return { ok: false as const, error: "Wrong password." };
  await ensureSchema();
  await setAdminCookie();
  refresh();
  return { ok: true as const };
}

export async function logout() {
  await clearAdminCookie();
  refresh();
}

export async function listPolls(): Promise<PollSummary[]> {
  await requireAdmin();
  await ensureSchema();
  return (await sql()`
    SELECT p.id, p.title, p.status, p.results_public, p.require_code, p.one_per_ip, p.created_at,
      (SELECT count(*)::int FROM candidates c WHERE c.poll_id = p.id) AS candidates,
      (SELECT coalesce(sum(votes), 0)::int FROM candidates c WHERE c.poll_id = p.id) AS votes,
      (SELECT count(*)::int FROM codes k WHERE k.poll_id = p.id) AS codes,
      (SELECT count(*)::int FROM codes k WHERE k.poll_id = p.id AND k.used) AS used
    FROM polls p ORDER BY p.created_at DESC
  `) as PollSummary[];
}

async function insertCodes(pollId: string, count: number) {
  const db = sql();
  let made = 0;
  for (let attempt = 0; attempt < 5 && made < count; attempt++) {
    const batch = Array.from({ length: count - made }, generateCode);
    const rows = await db`
      INSERT INTO codes (code, poll_id)
      SELECT unnest(${batch}::text[]), ${pollId}
      ON CONFLICT (code) DO NOTHING
      RETURNING code
    `;
    made += rows.length;
  }
  return made;
}

function parseNames(raw: string) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const name = line.trim().replace(/\s+/g, " ").slice(0, 80);
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

export async function createPoll(input: {
  title: string;
  names: string;
  requireCode: boolean;
  onePerIp: boolean;
  codes: number;
}) {
  await requireAdmin();
  await ensureSchema();

  const title = input.title.trim().slice(0, 120);
  const names = parseNames(input.names);
  const codeCount = Math.floor(Number(input.codes));

  if (!title) return { ok: false as const, error: "Give the poll a title." };
  if (names.length < 2) return { ok: false as const, error: "Add at least two names." };
  if (names.length > 500) return { ok: false as const, error: "Maximum 500 names." };
  if (input.requireCode && !(codeCount >= 1 && codeCount <= 2000)) {
    return { ok: false as const, error: "Number of codes must be between 1 and 2000." };
  }

  const id = newPollId();
  const db = sql();
  // Only one poll is live at a time: the new poll replaces the current one.
  await db.transaction([
    db`UPDATE polls SET status = 'closed' WHERE status = 'open'`,
    db`INSERT INTO polls (id, title, require_code, one_per_ip)
       VALUES (${id}, ${title}, ${!!input.requireCode}, ${!!input.onePerIp})`,
    db`INSERT INTO candidates (poll_id, name, position)
       SELECT ${id}, n, i FROM unnest(${names}::text[]) WITH ORDINALITY AS t(n, i)`,
  ]);
  if (input.requireCode) await insertCodes(id, codeCount);
  refresh();
  return { ok: true as const, id };
}

export async function addCodes(pollId: string, count: number) {
  await requireAdmin();
  const n = Math.floor(Number(count));
  if (!(n >= 1 && n <= 1000)) return { ok: false as const, error: "Between 1 and 1000." };
  await insertCodes(pollId, n);
  refresh();
  return { ok: true as const };
}

type Setting = "open" | "results_public" | "require_code" | "one_per_ip";

export async function updateSetting(pollId: string, setting: Setting, value: boolean) {
  await requireAdmin();
  const db = sql();
  switch (setting) {
    case "open":
      if (value) {
        // Only one poll is live at a time.
        await db.transaction([
          db`UPDATE polls SET status = 'closed' WHERE status = 'open' AND id <> ${pollId}`,
          db`UPDATE polls SET status = 'open' WHERE id = ${pollId}`,
        ]);
      } else {
        await db`UPDATE polls SET status = 'closed' WHERE id = ${pollId}`;
      }
      break;
    case "results_public":
      await db`UPDATE polls SET results_public = ${value} WHERE id = ${pollId}`;
      break;
    case "require_code":
      await db`UPDATE polls SET require_code = ${value} WHERE id = ${pollId}`;
      break;
    case "one_per_ip":
      await db`UPDATE polls SET one_per_ip = ${value} WHERE id = ${pollId}`;
      break;
  }
  refresh();
}

export async function deletePoll(pollId: string) {
  await requireAdmin();
  await sql()`DELETE FROM polls WHERE id = ${pollId}`;
  refresh();
}

/** Clears every vote, re-enables codes, forgets IPs and starts a new device round. */
export async function resetVotes(pollId: string) {
  await requireAdmin();
  const db = sql();
  await db.transaction([
    db`UPDATE candidates SET votes = 0 WHERE poll_id = ${pollId}`,
    db`UPDATE codes SET used = false WHERE poll_id = ${pollId}`,
    db`DELETE FROM voter_ips WHERE poll_id = ${pollId}`,
    db`UPDATE polls SET epoch = epoch + 1 WHERE id = ${pollId}`,
  ]);
  refresh();
}
