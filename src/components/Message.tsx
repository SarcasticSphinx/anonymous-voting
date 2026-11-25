import Link from "next/link";
import VotedBanner from "./VotedBanner";

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
    <div className="pt-14 sm:pt-24 max-w-md mx-auto">
      <VotedBanner />
      <h1 className="title-md enter">{title}</h1>
      <p className="lead mt-3 enter" style={{ "--i": 1 } as React.CSSProperties}>{body}</p>
      <div className="mt-8 enter" style={{ "--i": 2 } as React.CSSProperties}>
        {children ?? (
          <Link href="/polls" className="link-arrow">Past polls <span aria-hidden>&rarr;</span></Link>
        )}
      </div>
    </div>
  );
}
