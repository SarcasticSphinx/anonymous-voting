import { createHash } from "node:crypto";
import { connection } from "next/server";
import { loadResults } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { viewerHasVoted } from "@/lib/voter";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: RouteContext<"/api/results/[id]">) {
  await connection();
  const { id } = await ctx.params;

  try {
    const loaded = await loadResults(id);
    if (!loaded) return json({ error: "not_found" }, 404);
    if (!(await isAdmin())) {
      if (!loaded.isPublic) return json({ error: "hidden" }, 403);
      // While voting is open, only people who have voted may see the standings.
      if (loaded.results.poll.status === "open" && !(await viewerHasVoted(id, loaded.epoch, loaded.onePerIp))) {
        return json({ error: "vote_first" }, 403);
      }
    }

    // ETag: when nothing changed, the browser gets an empty 304 instead of the full list.
    const body = JSON.stringify(loaded.results);
    const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache",
      ETag: etag,
    };
    if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(body, { headers });
  } catch {
    return json({ error: "server" }, 500);
  }
}
