import { Suspense } from "react";
import { loadResults } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { viewerHasVoted } from "@/lib/voter";
import PollGate from "@/components/PollGate";
import Leaderboard from "@/components/Leaderboard";
import Message from "@/components/Message";
import Loader from "@/components/Loader";

export const metadata = { title: "Leaderboard" };

export default function ResultsPage({ params }: PageProps<"/p/[id]/results">) {
  return (
    <main className="shell pb-24">
      <Suspense fallback={<Loader />}>
        <ResultsLoader params={params} />
      </Suspense>
    </main>
  );
}

async function ResultsLoader({ params }: { params: PageProps<"/p/[id]/results">["params"] }) {
  const { id } = await params;
  const loaded = await loadResults(id, { fresh: true }).catch(() => null);

  if (!loaded) return <Message title="Poll not found" body="This link may be wrong or the poll was removed." />;
  if (!(await isAdmin())) {
    if (!loaded.isPublic) {
      return <Message title="Results are hidden" body="The organiser will reveal the leaderboard when voting ends." />;
    }
    // While voting is open, no vote means no leaderboard: show the ballot instead.
    if (loaded.results.poll.status === "open" && !(await viewerHasVoted(id, loaded.epoch))) {
      return <PollGate pollId={id} />;
    }
  }
  const results = loaded.results;
  return <Leaderboard initial={results} />;
}
