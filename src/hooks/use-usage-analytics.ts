"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_INTERVAL } from "@/hooks/use-router-data";
import type { UsageAnalytics } from "@/lib/router-types";

export function useUsageAnalytics(days = 30, enabled = true) {
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/usage/analytics?days=${days}`);
      const json = await res.json();
      if (requestId !== requestIdRef.current) return;

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load usage analytics");
      }
      setData(json as UsageAnalytics);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load usage analytics");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [days, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const initial = window.setTimeout(() => {
      void refresh();
    }, 0);
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
