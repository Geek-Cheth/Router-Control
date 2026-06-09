"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveSpeed } from "@/lib/router-types";

const LIVE_SPEED_POLL_MS = 1000;

export function useLiveSpeed(enabled = true) {
  const [speed, setSpeed] = useState<LiveSpeed | null>(null);
  const inFlight = useRef(false);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/router/speed", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setSpeed(json);
    } catch {
      // Keep last reading on transient failures.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const initial = setTimeout(() => {
      void poll();
    }, 0);
    const id = setInterval(() => {
      void poll();
    }, LIVE_SPEED_POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [enabled, poll]);

  return { speed };
}
