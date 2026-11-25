import { Suspense } from "react";
import PollGate from "@/components/PollGate";
import { PollSkeleton } from "@/components/Skeletons";

export const metadata = { title: "Vote" };

export default function VotePage({ params }: PageProps<"/p/[id]">) {
  return (
    <main className="shell shell-wide pb-40">
      <Suspense fallback={<PollSkeleton />}>
        <Gate params={params} />
      </Suspense>
    </main>
  );
}

async function Gate({ params }: { params: PageProps<"/p/[id]">["params"] }) {
  const { id } = await params;
  return <PollGate pollId={id} />;
}
