import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getArchive, getLivePollId } from "@/lib/db";
import { bn } from "@/lib/format";
import PollGate from "@/components/PollGate";
import Message from "@/components/Message";
import Loader from "@/components/Loader";

export default function Home() {
  return (
    <main className="shell shell-wide pb-40">
      <Suspense fallback={<Loader />}>
        <LivePoll />
      </Suspense>
    </main>
  );
}

async function LivePoll() {
  await connection(); // always look up the live poll at request time
  const id = await getLivePollId().catch(() => undefined);

  if (id === undefined) {
    return <Message title="Can't reach the database" body="Check DATABASE_URL in your environment settings." />;
  }
  if (id) return <PollGate pollId={id} />;

  const past = (await getArchive().catch(() => [])).slice(0, 5);
  return (
    <Message title="No poll is live" body="There is nothing to vote on right now. Check back soon.">
      {past.length > 0 && (
        <div>
          <div className="eyebrow mb-1">Past polls</div>
          {past.map((p) => (
            <Link key={p.id} href={`/p/${p.id}/results`} className="archive-item">
              <span className={bn(p.title, "font-medium")}>{p.title}</span>
              <span className="muted text-sm">{p.votes} votes</span>
            </Link>
          ))}
          <Link href="/polls" className="link-arrow mt-5">All past polls <span aria-hidden>&rarr;</span></Link>
        </div>
      )}
    </Message>
  );
}
