"use client";

import { useState, useTransition } from "react";
import { login } from "@/app/admin/actions";
import { ArrowRight, Lock } from "./icons";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await login(password).catch(() => ({ ok: false as const, error: "Server error. Check your environment settings." }));
      if (!res.ok) {
        setError(res.error);
        setShake((s) => s + 1);
      }
    });
  }

  return (
    <div className="pt-12 sm:pt-20">
      <div className="eyebrow enter"><Lock size={14} /> Organiser</div>
      <h1 className="title-md mt-3 enter" style={{ "--i": 1 } as React.CSSProperties}>Admin sign in</h1>
      <p className="lead mt-2 enter" style={{ "--i": 2 } as React.CSSProperties}>
        Create polls, control voting and reveal results.
      </p>
      <div className="mt-6 enter" style={{ "--i": 3 } as React.CSSProperties}>
      <form key={shake} onSubmit={submit} className={`card card-pad ${shake ? "shake" : ""}`}>
        <label className="label" htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          className="input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="error-text mt-3">{error}</p>}
        <button className="btn btn-primary btn-block mt-4" disabled={pending || !password}>
          {pending ? <span className="spinner" /> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>
      </div>
    </div>
  );
}
