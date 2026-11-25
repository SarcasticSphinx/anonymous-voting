import Link from "next/link";
import VotedBanner from "./VotedBanner";
import { bn } from "@/lib/format";

export default function Message({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="pt-14 sm:pt-24">
      <VotedBanner />
      <h1 className={bn(title, "title-md enter")}>{title}</h1>
      <p className="lead mt-3 enter" style={{ "--i": 1 } as React.CSSProperties}>{body}</p>
      <div className="mt-8 enter" style={{ "--i": 2 } as React.CSSProperties}>
        {children ?? (
          <Link href="/polls" className="link-arrow">Past polls <span aria-hidden>&rarr;</span></Link>
        )}
      </div>
    </div>
  );
}
