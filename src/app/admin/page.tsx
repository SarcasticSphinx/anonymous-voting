import { Suspense } from "react";
import { isAdmin } from "@/lib/auth";
import { CLASS_NAMES } from "@/lib/class-names";
import { listPolls } from "./actions";
import AdminLogin from "@/components/AdminLogin";
import AdminDashboard from "@/components/AdminDashboard";
import Loader from "@/components/Loader";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <main className="shell pb-24">
      <Suspense fallback={<Loader />}>
        <AdminGate />
      </Suspense>
    </main>
  );
}

async function AdminGate() {
  if (!(await isAdmin())) return <AdminLogin />;
  const polls = await listPolls().catch((err: unknown) =>
    err instanceof Error ? err.message : "Could not load polls.",
  );
  if (typeof polls === "string") {
    return (
      <div className="card card-pad mt-10">
        <p className="font-medium">Database error</p>
        <p className="lead text-sm mt-1">{polls} Check DATABASE_URL.</p>
      </div>
    );
  }
  return <AdminDashboard polls={polls} defaultNames={CLASS_NAMES.join("\n")} />;
}
