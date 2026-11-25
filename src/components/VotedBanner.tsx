"use client";

import { useEffect, useState } from "react";

/** Shows a short confirmation when the page was opened right after voting (?voted=1). */
export default function VotedBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("voted") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL once after mount
      setShow(true);
      url.searchParams.delete("voted");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  }, []);

  if (!show) return null;
  return (
    <div className="notice-bar pop mb-6" role="status">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.7 2.7L16 9.8" />
      </svg>
      Your vote was counted anonymously.
    </div>
  );
}
