"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { castVote, checkCode } from "@/app/actions";
import { bn, CODE_LENGTH, formatCode, normalizeCode } from "@/lib/format";
import { ArrowRight, Search } from "./icons";

type Props = {
  poll: {
    id: string;
    title: string;
    requireCode: boolean;
    candidates: { id: number; name: string }[];
  };
};

const simplify = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "");
const delay = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function VoteFlow({ poll }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"code" | "pick">(poll.requireCode ? "code" : "pick");
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [pending, startTransition] = useTransition();

  const numbered = useMemo(
    () => poll.candidates.map((c, i) => ({ ...c, n: i + 1, key: simplify(c.name) })),
    [poll.candidates],
  );
  const visible = useMemo(() => {
    const q = simplify(query);
    return q ? numbered.filter((c) => c.key.includes(q)) : numbered;
  }, [numbered, query]);
  const selectedName = numbered.find((c) => c.id === selected)?.name;

  function fail(msg: string) {
    setError(msg);
    setShake((s) => s + 1);
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await checkCode(poll.id, code).catch(() => null);
      if (!res) return fail("Network error. Try again.");
      if (!res.ok) return fail(res.error);
      setStep("pick");
    });
  }

  function submitVote() {
    if (selected == null) return;
    setError(null);
    startTransition(async () => {
      const res = await castVote(poll.id, selected, poll.requireCode ? code : null).catch(() => null);
      if (!res) return fail("Network error. Try again.");
      if (!res.ok) return fail(res.error);
      // Marks this device as having voted. Holds no information about the choice.
      document.cookie = `voted_${poll.id}=${res.epoch}; path=/; max-age=31536000; samesite=lax`;
      window.scrollTo({ top: 0 });
      router.push(`/p/${poll.id}/results?voted=1`);
    });
  }

  const header = (
    <h1 className={bn(poll.title, "title enter")} style={delay(1)}>{poll.title}</h1>
  );

  if (step === "code") {
    return (
      <div className="pt-8 sm:pt-14 max-w-md">
        {header}
        <p className="lead mt-4 enter" style={delay(2)}>
          Enter the one-time code you were given. It only unlocks the ballot and is never linked to your choice.
        </p>
        <div className="mt-8 enter" style={delay(3)}>
          <form onSubmit={submitCode} key={shake} className={shake ? "shake" : ""}>
            <label className="label" htmlFor="code">Voting code</label>
            <input
              id="code"
              className="input code-input"
              placeholder="XXXX-XXXX"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              value={formatCode(code)}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              autoFocus
            />
            {error && <p className="error-text mt-3">{error}</p>}
            <button className="btn btn-primary btn-block mt-4" disabled={pending || code.length !== CODE_LENGTH}>
              {pending ? <span className="spinner" /> : <>Continue <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-8 sm:pt-14">
      {header}
      <p className="lead mt-4 enter" style={delay(2)}>
        Choose one of {poll.candidates.length} names. Your vote is anonymous and you can vote once.
      </p>

      <div className="search-wrap mt-4">
        <div className="relative enter" style={delay(3)}>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none muted" />
          <input
            className="input"
            style={{ paddingLeft: 44 }}
            placeholder="Search a name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            enterKeyHint="search"
            aria-label="Search a name"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="lead text-center py-12 pop">No name matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="pick-grid">
          {visible.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className="pick"
              style={delay(i)}
              aria-pressed={selected === c.id}
              onClick={() => {
                setSelected(c.id);
                setError(null);
              }}
            >
              <span className="pick-num">{selected === c.id ? <CheckSmall /> : c.n}</span>
              <span className={bn(c.name, "pick-name")}>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="confirm-bar" data-open={selected != null}>
        <div className="shell shell-wide !px-0 flex items-center gap-3" key={shake}>
          <div className={`min-w-0 flex-1 ${shake ? "shake" : ""}`}>
            {error ? (
              <p className="error-text !text-[13.5px] leading-snug">{error}</p>
            ) : (
              <>
                <p className="text-[12px] muted">Your vote</p>
                <p className="font-semibold truncate text-[16px]">{selectedName}</p>
              </>
            )}
          </div>
          <button className="btn btn-primary shrink-0" onClick={submitVote} disabled={pending || selected == null}>
            {pending ? <span className="spinner" /> : "Submit vote"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="pop">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
