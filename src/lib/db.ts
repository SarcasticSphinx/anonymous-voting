import "server-only";
import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

/*
  Anonymity model
  ---------------
  A vote is ONE atomic database call (the cast_vote function below) that:
    1. checks the poll is open and the candidate belongs to it
    2. burns the one-time code (only if the poll requires codes)
    3. records a salted hash of the voter's IP (only if one-vote-per-IP is on)
    4. adds +1 to the candidate's counter
  If any check fails, everything rolls back.

  What is stored: vote totals per candidate, "used" flags on codes, and IP hashes.
  What is NOT stored: which code / IP / device chose which candidate, timestamps
  of votes, or raw IP addresses. Nobody, including the admin, can see who voted
  for whom, because that information never exists.
*/

let client: NeonQueryFunction<false, false> | null = null;

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local");
    // Optional: point the driver at a local Neon-compatible HTTP proxy for offline testing.
    if (process.env.NEON_LOCAL_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_LOCAL_ENDPOINT;
    client = neon<false, false>(url);
  }
  return client;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    const db = sql();
    schemaReady = db
      .transaction([
        db`CREATE TABLE IF NOT EXISTS polls (
          id text PRIMARY KEY,
          title text NOT NULL,
          status text NOT NULL DEFAULT 'open',
          results_public boolean NOT NULL DEFAULT true,
          require_code boolean NOT NULL DEFAULT false,
          one_per_ip boolean NOT NULL DEFAULT true,
          epoch int NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now()
        )`,
        db`CREATE TABLE IF NOT EXISTS candidates (
          id serial PRIMARY KEY,
          poll_id text NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
          name text NOT NULL,
          position int NOT NULL DEFAULT 0,
          votes int NOT NULL DEFAULT 0
        )`,
        db`CREATE TABLE IF NOT EXISTS codes (
          code text PRIMARY KEY,
          poll_id text NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
          used boolean NOT NULL DEFAULT false
        )`,
        db`CREATE TABLE IF NOT EXISTS voter_ips (
          poll_id text NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
          ip_hash text NOT NULL,
          PRIMARY KEY (poll_id, ip_hash)
        )`,
        db`CREATE INDEX IF NOT EXISTS candidates_poll_idx ON candidates(poll_id)`,
        db`CREATE INDEX IF NOT EXISTS codes_poll_idx ON codes(poll_id)`,
        db`CREATE OR REPLACE FUNCTION cast_vote(
            p_poll text, p_cand int, p_code text, p_ip text, p_device_epoch int
          ) RETURNS int LANGUAGE plpgsql AS $fn$
          DECLARE pr polls%ROWTYPE;
          BEGIN
            SELECT * INTO pr FROM polls WHERE id = p_poll;
            IF NOT FOUND THEN RAISE EXCEPTION 'VOTE:not_found'; END IF;
            IF pr.status <> 'open' THEN RAISE EXCEPTION 'VOTE:closed'; END IF;
            IF p_device_epoch = pr.epoch THEN RAISE EXCEPTION 'VOTE:device_used'; END IF;
            PERFORM 1 FROM candidates WHERE id = p_cand AND poll_id = p_poll;
            IF NOT FOUND THEN RAISE EXCEPTION 'VOTE:bad_candidate'; END IF;
            IF pr.require_code THEN
              UPDATE codes SET used = true
                WHERE code = p_code AND poll_id = p_poll AND used = false;
              IF NOT FOUND THEN RAISE EXCEPTION 'VOTE:bad_code'; END IF;
            END IF;
            IF pr.one_per_ip THEN
              INSERT INTO voter_ips (poll_id, ip_hash) VALUES (p_poll, p_ip)
                ON CONFLICT DO NOTHING;
              IF NOT FOUND THEN RAISE EXCEPTION 'VOTE:ip_used'; END IF;
            END IF;
            UPDATE candidates SET votes = votes + 1 WHERE id = p_cand;
            RETURN pr.epoch;
          END
          $fn$`,
      ])
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null;
        throw err;
      });
  }
  return schemaReady;
}

export type Poll = {
  id: string;
  title: string;
  status: "open" | "closed";
  results_public: boolean;
  require_code: boolean;
  one_per_ip: boolean;
  created_at: string;
};

export type PollSummary = Poll & {
  candidates: number;
  codes: number;
  used: number;
  votes: number;
};

export type Candidate = { id: number; name: string };
export type Standing = { id: number; name: string; votes: number };

export type Results = {
  poll: Pick<Poll, "id" | "title" | "status">;
  votesCast: number;
  standings: Standing[];
};

/** The single live poll (the newest open one, in case older data has several). */
export async function getLivePollId() {
  await ensureSchema();
  const rows = (await sql()`
    SELECT id FROM polls WHERE status = 'open' ORDER BY created_at DESC LIMIT 1
  `) as { id: string }[];
  return rows[0]?.id ?? null;
}

export type ArchiveItem = Pick<Poll, "id" | "title" | "status" | "results_public" | "created_at"> & {
  votes: number;
};

/** Every poll a visitor may look at: the live one plus past polls with public results. */
export async function getArchive(): Promise<ArchiveItem[]> {
  await ensureSchema();
  return (await sql()`
    SELECT p.id, p.title, p.status, p.results_public, p.created_at,
      (SELECT coalesce(sum(votes), 0)::int FROM candidates c WHERE c.poll_id = p.id) AS votes
    FROM polls p
    WHERE p.status = 'open' OR p.results_public
    ORDER BY (p.status = 'open') DESC, p.created_at DESC
    LIMIT 100
  `) as ArchiveItem[];
}

export async function getPollForVoting(pollId: string) {
  await ensureSchema();
  const db = sql();
  const [polls, candidates] = await db.transaction(
    [
      db`SELECT id, title, status, require_code, one_per_ip, results_public, epoch
          FROM polls WHERE id = ${pollId}`,
      db`SELECT id, name FROM candidates WHERE poll_id = ${pollId} ORDER BY position ASC`,
    ],
    { readOnly: true },
  );
  const poll = polls[0] as
    | (Pick<Poll, "id" | "title" | "status" | "require_code" | "one_per_ip" | "results_public"> & {
        epoch: number;
      })
    | undefined;
  if (!poll) return null;
  return { ...poll, candidates: candidates as Candidate[] };
}

export async function hasIpVoted(pollId: string, ipHash: string) {
  const rows = await sql()`
    SELECT 1 FROM voter_ips WHERE poll_id = ${pollId} AND ip_hash = ${ipHash}
  `;
  return rows.length > 0;
}

export async function getResults(pollId: string): Promise<Results | null> {
  await ensureSchema();
  const db = sql();
  const [polls, standings] = await db.transaction(
    [
      db`SELECT id, title, status FROM polls WHERE id = ${pollId}`,
      db`SELECT id, name, votes FROM candidates WHERE poll_id = ${pollId}
         ORDER BY votes DESC, position ASC`,
    ],
    { readOnly: true },
  );
  const poll = polls[0] as Results["poll"] | undefined;
  if (!poll) return null;
  const list = standings as Standing[];
  return {
    poll,
    votesCast: list.reduce((n, s) => n + s.votes, 0),
    standings: list,
  };
}

export async function isResultsPublic(pollId: string) {
  await ensureSchema();
  const rows = (await sql()`SELECT results_public FROM polls WHERE id = ${pollId}`) as {
    results_public: boolean;
  }[];
  return rows[0]?.results_public ?? null;
}
