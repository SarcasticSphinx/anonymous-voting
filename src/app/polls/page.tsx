import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getArchive } from "@/lib/db";
import { bn } from "@/lib/format";
import Loader from "@/components/Loader";

export const metadata = { title: "Past polls" };

export default function PollsPage() {
  return (
    <main className="shell pb-24">
      <div className="pt-8 sm:pt-12">
        <div className="eyebrow enter">Archive</div>
        <h1 className="title-md mt-3 enter" style={{ "--i": 1 } as React.CSSProperties}>Past polls</h1>
      </div>
      <Suspense fallback={<Loader />}>
        <List />
      </Suspense>
    </main>
  );
}

const fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

async function List() {
  await connection();
  const polls = await getArchive().catch(() => []);
  if (!polls.length) return <p className="lead mt-8 enter">No polls yet.</p>;

  return (
    <div className="mt-6">
      {polls.map((p, i) => {
        const live = p.status === "open";
        return (
          <Link
            key={p.id}
            href={live ? "/" : `/p/${p.id}/results`}
            className="archive-item enter"
            style={{ "--i": i + 2 } as React.CSSProperties}
          >
            <span className="min-w-0">
              <span className={bn(p.title, "block font-medium text-[17px] leading-snug")}>{p.title}</span>
              <span className="block muted text-sm mt-0.5">
                {fmt.format(new Date(p.created_at))} · {p.votes} {p.votes === 1 ? "vote" : "votes"}
              </span>
            </span>
            {live ? (
              <span className="tag"><span className="live-dot" /> Live</span>
            ) : (
              <span className="muted" aria-hidden>&rarr;</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
