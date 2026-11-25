import { connection } from "next/server";
import { getResults, isResultsPublic } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export async function GET(_req: Request, ctx: RouteContext<"/api/results/[id]">) {
  await connection();
  const { id } = await ctx.params;

  try {
    const isPublic = await isResultsPublic(id);
    if (isPublic === null) return Response.json({ error: "not_found" }, { status: 404 });
    if (!isPublic && !(await isAdmin())) {
      return Response.json({ error: "hidden" }, { status: 403 });
    }
    const results = await getResults(id);
    if (!results) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "server" }, { status: 500 });
  }
}
