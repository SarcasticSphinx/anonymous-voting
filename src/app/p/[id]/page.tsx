import { Suspense } from "react";
import PollGate from "@/components/PollGate";
import Loader from "@/components/Loader";

export const metadata = { title: "Vote" };

export default function VotePage({ params }: PageProps<"/p/[id]">) {
  return (
    <main className="shell shell-wide pb-40">
      <Suspense fallback={<Loader />}>
        <Gate params={params} />
      </Suspense>
    </main>
  );
}

async function Gate({ params }: { params: PageProps<"/p/[id]">["params"] }) {
  const { id } = await params;
  return <PollGate pollId={id} />;
}
