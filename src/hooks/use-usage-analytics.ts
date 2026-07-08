"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_INTERVAL } from "@/hooks/use-router-data";
import { useProfile } from "@/hooks/use-profile";
import type { UsageAnalytics } from "@/lib/router-types";

export function useUsageAnalytics(days = 30, enabled = true) {
  const { withProfile, activeProfileId, loading: profileLoading } = useProfile();
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
      const res = await fetch(withProfile(`/api/usage/analytics?days=${days}`));
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
  }, [days, enabled, withProfile]);

  useEffect(() => {
    if (!enabled || profileLoading) return;

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
  }, [enabled, refresh, activeProfileId, profileLoading]);

  return { data, loading: loading || profileLoading, error, refresh };
}
