import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatCode } from "@/lib/format";
import PrintButton from "@/components/PrintButton";
import { ArrowLeft } from "@/components/icons";

export const metadata = { title: "Voting codes" };

export default function CodesPage({ params }: PageProps<"/admin/codes/[id]">) {
  return (
    <main className="shell shell-wide pb-24">
      <Suspense fallback={<div className="skeleton mt-10" style={{ height: 300 }} />}>
        <Codes params={params} />
      </Suspense>
    </main>
  );
}

async function Codes({ params }: { params: PageProps<"/admin/codes/[id]">["params"] }) {
  if (!(await isAdmin())) {
    return (
      <div className="card card-pad mt-10 text-center">
        <p className="font-medium">Sign in required</p>
        <Link href="/admin" className="btn btn-primary mt-4">Go to admin</Link>
      </div>
    );
  }

  const { id } = await params;
  const db = sql();
  const [polls, codes] = await db.transaction([
    db`SELECT title FROM polls WHERE id = ${id}`,
    // Only unused codes, in random order, so the sheet reveals nothing about who already voted.
    db`SELECT code FROM codes WHERE poll_id = ${id} AND used = false ORDER BY random()`,
  ]);
  const title = (polls[0] as { title: string } | undefined)?.title;
  if (!title) return <p className="lead mt-10">Poll not found.</p>;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/p/${id}`;
  const list = codes as { code: string }[];

  return (
    <div className="pt-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <Link href="/admin" className="eyebrow hover:opacity-80"><ArrowLeft size={14} /> Dashboard</Link>
          <h1 className="title-md mt-3">{title}</h1>
          <p className="lead text-sm mt-1">
            {list.length} unused codes. Cut them out, shuffle, and hand them out at random.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="slips">
        {list.map((c) => (
          <div key={c.code} className="slip">
            <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{title}</div>
            <div className="slip-code">{formatCode(c.code)}</div>
            <div className="text-[11px] break-all" style={{ color: "var(--muted)" }}>{url}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
