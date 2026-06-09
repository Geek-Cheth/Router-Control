"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "@/lib/router-types";

export const POLL_INTERVAL = 10000;

export function useRouterData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/router/dashboard");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to connect to router");
        setData(null);
      } else {
        setData(json);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch {
      setError("Network error — is the dev server running?");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => {
      void fetchData();
    }, 0);
    const id = setInterval(() => {
      void fetchData();
    }, POLL_INTERVAL);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [fetchData]);

  return { data, error, loading, lastUpdated, refresh: fetchData };
}
