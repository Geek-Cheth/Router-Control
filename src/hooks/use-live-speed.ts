"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveSpeed } from "@/lib/router-types";

/** Poll interval for live speed — 1s (byte-delta accuracy) */
export const LIVE_SPEED_POLL_MS = 1000;

export function useLiveSpeed(enabled = true) {
  const [speed, setSpeed] = useState<LiveSpeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/router/speed", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Speed fetch failed");
      } else {
        setSpeed(json);
        setError(null);
      }
    } catch {
      setError("Speed fetch failed");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    poll();
    const id = setInterval(poll, LIVE_SPEED_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, poll]);

  return { speed, error };
}
