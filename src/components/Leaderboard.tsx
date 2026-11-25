"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Results, Standing } from "@/lib/db";
import VotedBanner from "./VotedBanner";

const POLL_MS = 4000;

export default function Leaderboard({ initial, note }: { initial: Results; note?: string }) {
  const [data, setData] = useState(initial);
  const [changed, setChanged] = useState<Set<number>>(new Set());
  const prev = useRef(new Map(initial.standings.map((s) => [s.id, s.votes])));

  // Live updates. Pauses while the tab is hidden to save battery and data.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/results/${initial.poll.id}`, { cache: "no-store" });
          if (res.ok && alive) {
            const next: Results = await res.json();
            const moved = new Set<number>();
            for (const s of next.standings) {
              if (prev.current.get(s.id) !== s.votes) moved.add(s.id);
            }
            prev.current = new Map(next.standings.map((s) => [s.id, s.votes]));
            if (moved.size) setChanged(moved);
            setData(next);
          }
        } catch {}
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [initial.poll.id]);

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
      <h1 className="title mt-5 enter" style={{ "--i": 2 } as React.CSSProperties}>
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
              {lowest.shown.map((s) => (
                <div key={s.id} className="rank-row" data-low="true">
                  <span className="rank-bar" style={{ transform: `scaleX(${s.votes / max})` }} />
                  <span className="rank-pos">{rankOf(ranked, s.id)}</span>
                  <span className="rank-name">{s.name}</span>
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
        <RankList ranked={ranked} max={max} changed={changed} topVotes={votesCast ? leader.votes : -1} lowVotes={votesCast ? lowest.min : -1} />
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
  // Competition ranking: ties share a rank (1, 2, 2, 4).
  let rank = 0;
  return list.map((s, i) => {
    if (i === 0 || s.votes !== list[i - 1].votes) rank = i + 1;
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

function Podium({ ranked }: { ranked: Ranked[] }) {
  const top = ranked.slice(0, 3).filter((r) => r.votes > 0);
  // Visual order: 2nd, 1st, 3rd
  const slots = [top[1], top[0], top[2]];
  const places = [2, 1, 3];
  return (
    <div className="podium">
      {slots.map((s, i) =>
        s ? (
          <div key={s.id} className="podium-slot" data-place={places[i]}>
            <span className="podium-name">{s.name}</span>
            <span className="podium-votes">
              <CountUp value={s.votes} /> {s.votes === 1 ? "vote" : "votes"}
            </span>
            <div className="podium-block">{s.rank}</div>
          </div>
        ) : (
          <div key={`empty-${i}`} />
        ),
      )}
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
  changed: Set<number>;
  topVotes: number;
  lowVotes: number;
}) {
  const rows = useRef(new Map<number, HTMLDivElement>());
  const lastTops = useRef(new Map<number, number>());

  // FLIP: animate rows from their old position to the new one when order changes.
  useLayoutEffect(() => {
    const tops = new Map<number, number>();
    rows.current.forEach((el, id) => tops.set(id, el.getBoundingClientRect().top));
    tops.forEach((top, id) => {
      const before = lastTops.current.get(id);
      const el = rows.current.get(id);
      if (before == null || !el || before === top) return;
      el.animate(
        [{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }],
        { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
    lastTops.current = tops;
  }, [ranked]);

  return (
    <div className="rank-list">
      {ranked.map((s, i) => (
        <div
          key={s.id}
          ref={(el) => {
            if (el) rows.current.set(s.id, el);
            else rows.current.delete(s.id);
          }}
          className="rank-row enter"
          style={{ "--i": Math.min(i, 20) + 8 } as React.CSSProperties}
          data-top={s.votes === topVotes && topVotes > 0}
          data-low={s.votes === lowVotes && lowVotes !== topVotes}
        >
          <span className="rank-bar" style={{ transform: `scaleX(${s.votes / max})` }} />
          <span className="rank-pos">{s.rank}</span>
          <span className="rank-name">{s.name}</span>
          <span key={changed.has(s.id) ? `c${s.votes}` : "s"} className={`rank-votes inline-block ${changed.has(s.id) ? "bump" : ""}`}>
            {s.votes}
          </span>
        </div>
      ))}
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const a = current.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const next = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      current.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown}</>;
}
