import { Suspense } from "react";
import { getResults, isResultsPublic } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import Leaderboard from "@/components/Leaderboard";
import Message from "@/components/Message";
import Loader from "@/components/Loader";

export const metadata = { title: "Leaderboard" };

export default function ResultsPage({ params }: PageProps<"/p/[id]/results">) {
  return (
    <main className="shell shell-wide pb-24">
      <Suspense fallback={<Loader />}>
        <ResultsLoader params={params} />
      </Suspense>
    </main>
  );
}

async function ResultsLoader({ params }: { params: PageProps<"/p/[id]/results">["params"] }) {
  const { id } = await params;
  const isPublic = await isResultsPublic(id).catch(() => null);

  if (isPublic === null) return <Message title="Poll not found" body="This link may be wrong or the poll was removed." />;
  if (!isPublic && !(await isAdmin())) {
    return <Message title="Results are hidden" body="The organiser will reveal the leaderboard when voting ends." />;
  }
  const results = await getResults(id);
  if (!results) return <Message title="Poll not found" body="This poll was removed." />;
  return <Leaderboard initial={results} />;
}
