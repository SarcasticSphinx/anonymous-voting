"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { PollSummary } from "@/lib/db";
import {
  addCodes,
  createPoll,
  deletePoll,
  logout,
  resetVotes,
  updateSetting,
} from "@/app/admin/actions";
import { Chart, Link2, Plus, Printer, Refresh, Trash } from "./icons";
import { bn } from "@/lib/format";

type Props = { polls: PollSummary[]; defaultNames: string };

export default function AdminDashboard({ polls, defaultNames }: Props) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [showNew, setShowNew] = useState(polls.length === 0);

  const notify = (text: string) => setToast({ id: Date.now(), text });

  return (
    <div className="pt-8 sm:pt-12">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow enter">Organiser</div>
          <h1 className="title-md mt-2 enter" style={{ "--i": 1 } as React.CSSProperties}>Dashboard</h1>
        </div>
        <form action={logout} className="enter" style={{ "--i": 2 } as React.CSSProperties}>
          <button className="btn btn-ghost btn-sm">Sign out</button>
        </form>
      </div>

      <div className="mt-6 enter" style={{ "--i": 3 } as React.CSSProperties}>
        {showNew ? (
          <NewPoll
            defaultNames={defaultNames}
            onDone={() => {
              setShowNew(false);
              notify("Poll created");
            }}
            onCancel={polls.length ? () => setShowNew(false) : undefined}
          />
        ) : (
          <button className="btn btn-primary btn-block" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New poll
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 mt-8">
        {polls.map((p, i) => (
          <PollCard key={p.id} poll={p} i={i + 4} notify={notify} />
        ))}
      </div>

      {toast && (
        <div key={toast.id} className="toast" role="status" onAnimationEnd={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ---------- New poll ---------- */

function NewPoll({
  defaultNames,
  onDone,
  onCancel,
}: {
  defaultNames: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [names, setNames] = useState(defaultNames);
  const [onePerIp, setOnePerIp] = useState(true);
  const [requireCode, setRequireCode] = useState(false);
  const count = names.split(/\r?\n/).filter((n) => n.trim()).length;
  const [codes, setCodes] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createPoll({
        title,
        names,
        onePerIp,
        requireCode,
        codes: codes === "" ? count : codes,
      }).catch(() => ({ ok: false as const, error: "Server error." }));
      if (!res.ok) setError(res.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={submit} className="card card-pad pop">
      <h2 className="text-lg font-semibold tracking-tight">New poll</h2>
      <p className="text-[13px] muted mt-1">It goes live straight away and closes the current live poll.</p>

      <label className="label mt-5" htmlFor="title">Question</label>
      <input
        id="title"
        className="input"
        placeholder="Best boy in the class"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
      />

      <div className="flex items-center justify-between mt-5 mb-2">
        <label className="label !mb-0" htmlFor="names">Names, one per line</label>
        <span className="tag">{count} names</span>
      </div>
      <textarea
        id="names"
        className="input"
        rows={8}
        value={names}
        onChange={(e) => setNames(e.target.value)}
        spellCheck={false}
      />

      <div className="flex flex-col gap-1 mt-5">
        <Toggle
          label="One vote per network (IP)"
          hint="Blocks a second vote from the same internet connection. People on the same Wi-Fi share one IP, so only one of them could vote."
          checked={onePerIp}
          onChange={setOnePerIp}
        />
        <Toggle
          label="Require one-time codes"
          hint="Strongest protection. Print the codes and hand one to each person at random."
          checked={requireCode}
          onChange={setRequireCode}
        />
      </div>

      {requireCode && (
        <div className="pop mt-3">
          <label className="label" htmlFor="codes">How many codes</label>
          <input
            id="codes"
            type="number"
            inputMode="numeric"
            min={1}
            max={2000}
            className="input"
            placeholder={String(count)}
            value={codes}
            onChange={(e) => setCodes(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
      )}

      {error && <p className="error-text mt-4">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6">
        {onCancel && (
          <button type="button" className="btn btn-ghost sm:flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary sm:flex-1" disabled={pending}>
          {pending ? <span className="spinner" /> : "Create and go live"}
        </button>
      </div>
    </form>
  );
}

/* ---------- Poll card ---------- */

function PollCard({
  poll,
  i,
  notify,
}: {
  poll: PollSummary;
  i: number;
  notify: (t: string) => void;
}) {
  const [pending, start] = useTransition();
  const open = poll.status === "open";
  const turnout = poll.require_code && poll.codes ? poll.used / poll.codes : null;

  const run = (fn: () => Promise<unknown>, msg: string) =>
    start(async () => {
      try {
        await fn();
        notify(msg);
      } catch {
        notify("Something went wrong");
      }
    });

  async function copyLink() {
    const url = `${location.origin}/p/${poll.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify("Voting link copied");
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <article className="card card-pad enter" style={{ "--i": i } as React.CSSProperties} aria-busy={pending}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={bn(poll.title, "text-lg font-semibold tracking-tight leading-snug")}>{poll.title}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {poll.candidates} names · {poll.votes} {poll.votes === 1 ? "vote" : "votes"}
            {poll.require_code && ` · ${poll.used}/${poll.codes} codes used`}
          </p>
        </div>
        <span className="tag">
          <span className="live-dot" data-closed={!open} />
          {open ? "Live" : "Closed"}
        </span>
      </div>

      {turnout != null && (
        <div className="track mt-4">
          <div className="track-fill" style={{ transform: `scaleX(${turnout})` }} />
        </div>
      )}

      <div className="divider my-4" />

      <div className="flex flex-col gap-1">
        <Toggle
          label="Live"
          hint={open ? undefined : "Making this poll live closes the current one."}
          checked={open}
          disabled={pending}
          onChange={(v) => run(() => updateSetting(poll.id, "open", v), v ? "Poll is live" : "Poll closed")}
        />
        <Toggle
          label="Leaderboard visible to everyone"
          checked={poll.results_public}
          disabled={pending}
          onChange={(v) => run(() => updateSetting(poll.id, "results_public", v), v ? "Leaderboard is public" : "Leaderboard hidden")}
        />
        <Toggle
          label="One vote per network (IP)"
          checked={poll.one_per_ip}
          disabled={pending}
          onChange={(v) => run(() => updateSetting(poll.id, "one_per_ip", v), v ? "IP limit on" : "IP limit off")}
        />
        <Toggle
          label="Require one-time codes"
          checked={poll.require_code}
          disabled={pending}
          onChange={(v) => run(() => updateSetting(poll.id, "require_code", v), v ? "Codes required" : "Codes not required")}
        />
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-5">
        <button className="btn btn-sm" onClick={copyLink}>
          <Link2 size={15} /> Copy link
        </button>
        <Link className="btn btn-sm" href={`/p/${poll.id}/results`}>
          <Chart size={15} /> Leaderboard
        </Link>
        {poll.require_code && (
          <>
            <Link className="btn btn-sm" href={`/admin/codes/${poll.id}`}>
              <Printer size={15} /> Print codes
            </Link>
            <button
              className="btn btn-sm"
              disabled={pending}
              onClick={() => {
                const n = Number(window.prompt("How many extra codes?", "10"));
                if (n > 0) run(() => addCodes(poll.id, n), `${n} codes added`);
              }}
            >
              <Plus size={15} /> Add codes
            </button>
          </>
        )}
        <button
          className="btn btn-sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Reset all votes for "${poll.title}"? Everyone will be able to vote again.`)) {
              run(() => resetVotes(poll.id), "Votes reset");
            }
          }}
        >
          <Refresh size={15} /> Reset
        </button>
        <button
          className="btn btn-sm btn-danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete "${poll.title}" permanently? This cannot be undone.`)) {
              run(() => deletePoll(poll.id), "Poll deleted");
            }
          }}
        >
          <Trash size={15} /> Delete
        </button>
      </div>
    </article>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[15px] font-medium leading-snug">{label}</p>
        {hint && (
          <p className="text-[13px] mt-1 leading-snug" style={{ color: "var(--muted)" }}>
            {hint}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch mt-0.5"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
