"use client";

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export function UsernamePrompt() {
  const { needsUsername, setUsername } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!needsUsername) return null;

  const valid = /^[a-zA-Z0-9_]{3,32}$/.test(value.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await setUsername(value.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set username.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a username"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex flex-col items-center gap-2 text-center mb-5">
          <div className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-2xl">👋</div>
          <h2 className="text-xl text-foreground">Choose your username</h2>
          <p className="text-sm text-muted-foreground">
            This is how other players will see you. You can&apos;t play until it&apos;s set.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. blitz_master"
            maxLength={32}
            className="w-full rounded-xl border border-input bg-muted px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/50 transition"
          />
          <p className="text-xs text-muted-foreground -mt-1 px-1">
            3–32 characters · letters, numbers, and underscores only
          </p>

          {error && <p className="text-xs text-destructive px-1">{error}</p>}

          <button
            type="submit"
            disabled={!valid || submitting}
            className="w-full rounded-xl bg-primary py-3.5 text-base text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
