import { createHash } from "node:crypto";
import { connection } from "next/server";
import { loadResults } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: RouteContext<"/api/results/[id]">) {
  await connection();
  const { id } = await ctx.params;

  try {
    const loaded = await loadResults(id);
    if (!loaded) return json({ error: "not_found" }, 404);
    if (!loaded.isPublic && !(await isAdmin())) return json({ error: "hidden" }, 403);

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
