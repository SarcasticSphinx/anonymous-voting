"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Results, Standing } from "@/lib/db";
import VotedBanner from "./VotedBanner";
import { bn } from "@/lib/format";

const POLL_MS = 3000;
const TIMEOUT_MS = 8000;

/** A podium step lists names only up to this many people; beyond it, a summary. */
const PODIUM_NAMES = 2;
/** Names shown per Standings row before "+N more". */
const ROW_NAMES = 6;

/** Cheap fingerprint of everything the board shows; identical updates are ignored. */
const signature = (r: Results) =>
  `${r.poll.status}|${r.poll.title}|${r.standings.map((s) => `${s.id}:${s.votes}`).join(",")}`;

export default function Leaderboard({ initial, note }: { initial: Results; note?: string }) {
  const [data, setData] = useState(initial);

  // Live updates. Invisible by design: unchanged data causes no render at all,
  // and changed data is applied in place (rows are keyed by score, names by person).
  useEffect(() => {
    const url = `/api/results/${initial.poll.id}`;
    let alive = true;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSig = signature(initial);

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
  const tiers = useMemo(() => tiersOf(standings), [standings]);
  const top = tiers[0]?.votes ?? 0;

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
        <Stat i={4} label="Top score" value={top} />
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
            <Podium tiers={tiers} />
          </section>

          <section className="card card-pad mt-4 enter" style={{ "--i": 7 } as React.CSSProperties}>
            <div className="eyebrow mb-2">Standings</div>
            <Standings tiers={tiers} max={Math.max(1, top)} />
          </section>
        </>
      )}

      <div className="mt-10">
        <Link href="/polls" className="link-arrow">Past polls <span aria-hidden>&rarr;</span></Link>
      </div>
    </div>
  );
}

/* ---------- Pieces ---------- */

/** One row per score: everyone with the same number of votes, in ballot order. */
type Tier = { rank: number; votes: number; people: Standing[] };

function tiersOf(standings: Standing[]): Tier[] {
  // standings arrive sorted by votes (desc), then ballot order.
  const tiers: Tier[] = [];
  for (const s of standings) {
    const last = tiers[tiers.length - 1];
    if (last && last.votes === s.votes) last.people.push(s);
    else tiers.push({ rank: tiers.length + 1, votes: s.votes, people: [s] });
  }
  return tiers;
}

const votesLabel = (n: number) => (n === 1 ? "vote" : "votes");
const peopleLabel = (n: number) => (n === 1 ? "1 person" : `${n} people`);

function Stat({ label, value, i }: { label: string; value: number; i: number }) {
  return (
    <div className="card p-3 sm:p-5 stat enter" style={{ "--i": i } as React.CSSProperties}>
      <span className="stat-value"><CountUp value={value} /></span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/**
 * Each step is a vote level (1st, 2nd and 3rd highest score). A step names
 * at most two people; a bigger tie shows a summary instead of a wall of names
 * (the names are in Standings right below).
 */
function Podium({ tiers }: { tiers: Tier[] }) {
  const levels = tiers.filter((t) => t.votes > 0).slice(0, 3);
  const slots = [levels[1], levels[0], levels[2]]; // visual order: 2nd, 1st, 3rd
  const places = [2, 1, 3];
  return (
    <div className="podium">
      {slots.map((t, i) => {
        if (!t) return <div key={`empty-${places[i]}`} />;
        const crowded = t.people.length > PODIUM_NAMES;
        const each = t.people.length > 1 ? " each" : "";
        return (
          <div key={`place-${places[i]}`} className="podium-slot" data-place={places[i]}>
            <div
              key={crowded ? `n${t.people.length}` : t.people.map((p) => p.id).join(",")}
              className="podium-names swap"
            >
              {crowded ? (
                <>
                  <span className="podium-name">{peopleLabel(t.people.length)}</span>
                  <span className="podium-more">tied</span>
                </>
              ) : (
                t.people.map((p) => (
                  <span key={p.id} className={bn(p.name, "podium-name")}>{p.name}</span>
                ))
              )}
            </div>
            <span className="podium-votes">
              <CountUp value={t.votes} /> {votesLabel(t.votes)}
              {each}
            </span>
            <div className="podium-block">{t.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Standings grouped by score. Long groups show the first few names with a
 * "+N more" toggle; the zero-vote group starts collapsed.
 */
function Standings({ tiers, max }: { tiers: Tier[]; max: number }) {
  // Expanded rows are remembered by score, so live updates don't collapse them.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const toggle = (votes: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(votes)) next.delete(votes);
      else next.add(votes);
      return next;
    });

  return (
    <div className="tiers">
      {tiers.map((t, i) => {
        const isOpen = expanded.has(t.votes);
        const cap = t.votes === 0 ? 0 : ROW_NAMES;
        const shown = isOpen ? t.people : t.people.slice(0, cap);
        const hidden = t.people.length - shown.length;
        const leading = i === 0 && t.votes > 0;
        const lowest = i === tiers.length - 1 && tiers.length > 1;
        return (
          <div key={t.votes} className="tier swap" data-leading={leading || undefined}>
            <div className="tier-head">
              <span className="tier-rank">#{t.rank}</span>
              <span className="tier-votes">
                <b>{t.votes}</b> {votesLabel(t.votes)}
              </span>
              <span className="tier-count">{peopleLabel(t.people.length)}</span>
              {leading && <span className="tier-tag">Leading</span>}
              {lowest && <span className="tier-tag">Lowest</span>}
            </div>
            <div className="tier-bar">
              <span style={{ transform: `scaleX(${t.votes / max})` }} />
            </div>
            {shown.length > 0 && (
              <div className="tier-names">
                {shown.map((p) => (
                  <span key={p.id} className={bn(p.name, "chip swap")}>{p.name}</span>
                ))}
              </div>
            )}
            {(hidden > 0 || (isOpen && t.people.length > cap)) && (
              <button type="button" className="tier-more" onClick={() => toggle(t.votes)}>
                {isOpen ? "Show less" : cap === 0 ? `Show ${hidden} names` : `+${hidden} more`}
              </button>
            )}
          </div>
        );
      })}
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
