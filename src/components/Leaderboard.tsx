"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Results, Standing } from "@/lib/db";
import VotedBanner from "./VotedBanner";
import { bn } from "@/lib/format";

const POLL_MS = 3000;
const TIMEOUT_MS = 8000;

/** Cheap fingerprint of everything the board shows; identical updates are ignored. */
const signature = (r: Results) =>
  `${r.poll.status}|${r.poll.title}|${r.standings.map((s) => `${s.id}:${s.votes}`).join(",")}`;

export default function Leaderboard({ initial, note }: { initial: Results; note?: string }) {
  const [data, setData] = useState(initial);
  const [changed, setChanged] = useState<ReadonlySet<number>>(new Set());

  // Live updates. Invisible by design: unchanged data causes no render at all,
  // and changed data is applied in place (see RankList / Podium).
  useEffect(() => {
    const url = `/api/results/${initial.poll.id}`;
    let alive = true;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSig = signature(initial);
    let lastVotes = new Map(initial.standings.map((s) => [s.id, s.votes]));

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (alive) timer = setTimeout(tick, ms);
    };

    async function tick() {
      // Hidden tab: stop here. The visibilitychange listener resumes polling.
      if (!alive || busy || document.visibilityState !== "visible") return;
      busy = true;
      const ctrl = new AbortController();
      const abort = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let closed = false;
      try {
        // no-cache lets the browser revalidate with the ETag: unchanged data costs a tiny 304.
        const res = await fetch(url, { cache: "no-cache", signal: ctrl.signal });
        if (res.ok) {
          const next: Results = await res.json();
          closed = next.poll.status !== "open";
          const sig = signature(next);
          if (alive && sig !== lastSig) {
            lastSig = sig;
            const moved = new Set<number>();
            for (const s of next.standings) if (lastVotes.get(s.id) !== s.votes) moved.add(s.id);
            lastVotes = new Map(next.standings.map((s) => [s.id, s.votes]));
            setChanged(moved);
            setData(next);
          }
        }
      } catch {
        // Network hiccup: try again on the next tick.
      } finally {
        clearTimeout(abort);
        busy = false;
      }
      if (!closed) schedule(POLL_MS); // final results never change, so polling stops
    }

    const wake = () => {
      if (document.visibilityState === "visible") schedule(0);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    if (initial.poll.status === "open") schedule(POLL_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [initial]);

  const { standings, votesCast, poll } = data;
  const open = poll.status === "open";
  const max = Math.max(1, ...standings.map((s) => s.votes));

  const ranked = useMemo(() => withRanks(standings), [standings]);
  const lowest = useMemo(() => lowestGroup(standings), [standings]);
  const leader = ranked[0];

  return (
    <div className="pt-8 sm:pt-14">
      <VotedBanner />
      {note && <p className="notice-bar mb-6 enter">{note}</p>}

      <span className="tag enter" style={{ "--i": 1 } as React.CSSProperties}>
        <span className="live-dot" data-closed={!open} />
        {open ? "Live results" : "Final results"}
      </span>
      <h1 className={bn(poll.title, "title mt-5 enter")} style={{ "--i": 2 } as React.CSSProperties}>
        {poll.title}
      </h1>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-6">
        <Stat i={3} label="Votes cast" value={votesCast} />
        <Stat i={4} label="Top score" value={leader?.votes ?? 0} />
      </div>

      {votesCast === 0 ? (
        <div className="card card-pad mt-6 text-center enter" style={{ "--i": 6 } as React.CSSProperties}>
          <p className="font-medium text-lg">No votes yet</p>
          <p className="lead text-sm mt-1">This page updates by itself as votes come in.</p>
        </div>
      ) : (
        <>
          <section className="card card-pad mt-6 enter" style={{ "--i": 6 } as React.CSSProperties}>
            <div className="eyebrow mb-6">Top votes</div>
            <Podium ranked={ranked} />
          </section>

          <section className="card card-pad mt-4 enter" style={{ "--i": 7 } as React.CSSProperties}>
            <div className="eyebrow mb-4">Lowest votes</div>
            <div className="rank-list">
              {/* Keyed by slot, not by person: a name change crossfades instead of rebuilding the row */}
              {lowest.shown.map((s, i) => (
                <div key={i} className="rank-row" data-low="true">
                  <span className="rank-bar" style={{ transform: `scaleX(${s.votes / max})` }} />
                  <span className="rank-pos">{rankOf(ranked, s.id)}</span>
                  <span key={s.id} className={bn(s.name, "rank-name swap")}>{s.name}</span>
                  <span className="rank-votes"><CountUp value={s.votes} /></span>
                </div>
              ))}
            </div>
            {lowest.extra > 0 && (
              <p className="text-sm mt-3 muted">
                and {lowest.extra} more tied at {lowest.min} {lowest.min === 1 ? "vote" : "votes"}
              </p>
            )}
          </section>
        </>
      )}

      <section className="mt-8">
        <div className="eyebrow mb-3 enter" style={{ "--i": 8 } as React.CSSProperties}>Full ranking</div>
        <RankList
          ranked={ranked}
          max={max}
          changed={changed}
          topVotes={votesCast ? leader.votes : -1}
          lowVotes={votesCast ? lowest.min : -1}
        />
      </section>

      <div className="mt-10">
        <Link href="/polls" className="link-arrow">Past polls <span aria-hidden>&rarr;</span></Link>
      </div>
    </div>
  );
}

/* ---------- Pieces ---------- */

type Ranked = Standing & { rank: number };

function withRanks(list: Standing[]): Ranked[] {
  // Dense ranking: equal votes share a rank and the next score is the next
  // number (1, 1, 2, 3). Matches the podium, where each step is one vote level.
  let rank = 0;
  return list.map((s, i) => {
    if (i === 0 || s.votes !== list[i - 1].votes) rank += 1;
    return { ...s, rank };
  });
}

function rankOf(ranked: Ranked[], id: number) {
  return ranked.find((r) => r.id === id)?.rank ?? "";
}

function lowestGroup(list: Standing[]) {
  if (!list.length) return { shown: [], extra: 0, min: 0 };
  const asc = [...list].reverse();
  const min = asc[0].votes;
  const shown = asc.slice(0, 3);
  const tiedAtMin = list.filter((s) => s.votes === min).length;
  const extra = Math.max(0, tiedAtMin - shown.filter((s) => s.votes === min).length);
  return { shown, extra, min };
}

function Stat({ label, value, i }: { label: string; value: number; i: number }) {
  return (
    <div className="card p-3 sm:p-5 stat enter" style={{ "--i": i } as React.CSSProperties}>
      <span className="stat-value"><CountUp value={value} /></span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

const PODIUM_NAMES = 3;

/**
 * Each podium step is a vote level, not a person: everyone tied on the top
 * score stands together on step 1, the next score on step 2, and so on.
 */
function Podium({ ranked }: { ranked: Ranked[] }) {
  const levels: { rank: number; votes: number; people: Ranked[] }[] = [];
  for (const r of ranked) {
    if (r.votes <= 0) break;
    const last = levels[levels.length - 1];
    if (last && last.votes === r.votes) last.people.push(r);
    else if (levels.length < 3) levels.push({ rank: r.rank, votes: r.votes, people: [r] });
    else break;
  }
  // Visual order: 2nd, 1st, 3rd. Slots are keyed by place, so changes update in place.
  const slots = [levels[1], levels[0], levels[2]];
  const places = [2, 1, 3];
  return (
    <div className="podium">
      {slots.map((level, i) => {
        if (!level) return <div key={`empty-${places[i]}`} />;
        const shown = level.people.slice(0, PODIUM_NAMES);
        const more = level.people.length - shown.length;
        return (
          <div key={`place-${places[i]}`} className="podium-slot" data-place={places[i]}>
            <div key={level.people.map((p) => p.id).join(",")} className="podium-names swap">
              {shown.map((p) => (
                <span key={p.id} className={bn(p.name, "podium-name")}>{p.name}</span>
              ))}
              {more > 0 && <span className="podium-more">+{more} more</span>}
            </div>
            <span className="podium-votes">
              <CountUp value={level.votes} /> {level.votes === 1 ? "vote" : "votes"}
              {level.people.length > 1 && <> each</>}
            </span>
            <div className="podium-block">{level.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

function RankList({
  ranked,
  max,
  changed,
  topVotes,
  lowVotes,
}: {
  ranked: Ranked[];
  max: number;
  changed: ReadonlySet<number>;
  topVotes: number;
  lowVotes: number;
}) {
  const rows = useRef(new Map<number, HTMLDivElement>());
  const lastTops = useRef(new Map<number, number>());
  // Entrance stagger is fixed at first render so later re-ranks never touch it.
  const [firstIndex] = useState(() => new Map(ranked.map((s, i) => [s.id, i])));

  // Rows stay in one fixed DOM order (by id). Their on-screen order comes from
  // the CSS `order` property, so re-ranking never moves DOM nodes — which would
  // restart their CSS animations and look like a reload.
  const stable = useMemo(() => [...ranked].sort((a, b) => a.id - b.id), [ranked]);
  const position = useMemo(() => new Map(ranked.map((s, i) => [s.id, i])), [ranked]);
  const orderKey = useMemo(() => ranked.map((s) => s.id).join(","), [ranked]);

  // FLIP: when the order changes, slide each row from where it was to where it is.
  // offsetTop ignores page scroll and in-flight transforms, so measurements stay exact.
  useLayoutEffect(() => {
    const tops = new Map<number, number>();
    rows.current.forEach((el, id) => tops.set(id, el.offsetTop));
    tops.forEach((top, id) => {
      const before = lastTops.current.get(id);
      const el = rows.current.get(id);
      if (before == null || !el || before === top) return;
      // If a previous slide is still running, start from where the row is right now.
      let from = before - top;
      const running = el.getAnimations().find((a) => a.id === "flip");
      if (running) {
        const t = getComputedStyle(el).transform;
        if (t && t !== "none") from += new DOMMatrixReadOnly(t).m42;
        running.cancel();
      }
      const anim = el.animate(
        [{ transform: `translateY(${from}px)` }, { transform: "translateY(0)" }],
        { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      anim.id = "flip";
    });
    lastTops.current = tops;
  }, [orderKey]);

  return (
    <div className="rank-list">
      {stable.map((s) => (
        <div
          key={s.id}
          ref={(el) => {
            if (el) rows.current.set(s.id, el);
            else rows.current.delete(s.id);
          }}
          className="rank-row enter"
          style={
            {
              order: position.get(s.id),
              "--i": Math.min(firstIndex.get(s.id) ?? 20, 20) + 8,
            } as React.CSSProperties
          }
          data-top={s.votes === topVotes && topVotes > 0}
          data-low={s.votes === lowVotes && lowVotes !== topVotes}
        >
          <span className="rank-bar" style={{ transform: `scaleX(${s.votes / max})` }} />
          <span className="rank-pos">{s.rank}</span>
          <span className={bn(s.name, "rank-name")}>{s.name}</span>
          <span
            key={changed.has(s.id) ? `c${s.votes}` : "s"}
            className={`rank-votes inline-block ${changed.has(s.id) ? "bump" : ""}`}
          >
            {s.votes}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Animated number. Writes straight to the DOM on each frame instead of
 * re-rendering React, which keeps it smooth on slow phones.
 */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    if (from === value) {
      el.textContent = String(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const next = Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3)));
      if (next !== shown.current) {
        shown.current = next;
        el.textContent = String(next);
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span ref={ref}>0</span>;
}
