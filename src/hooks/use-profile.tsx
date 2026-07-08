"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PROFILE_STORAGE_KEY } from "@/lib/profiles";
import { profileQuery } from "@/lib/profiles";

export interface PublicProfile {
  id: string;
  name: string;
  type: "dialog" | "huawei";
  host: string;
}

interface ProfileContextValue {
  profiles: PublicProfile[];
  activeProfileId: string;
  activeProfile: PublicProfile | null;
  loading: boolean;
  setActiveProfileId: (profileId: string) => void;
  profileParam: string;
  withProfile: (path: string) => string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState("dialog");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        const res = await fetch("/api/profiles", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || cancelled) return;

        const nextProfiles = (json.profiles ?? []) as PublicProfile[];
        setProfiles(nextProfiles);

        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(PROFILE_STORAGE_KEY)
            : null;
        const fallback = json.activeProfileId ?? nextProfiles[0]?.id ?? "dialog";
        const initial =
          stored && nextProfiles.some((profile) => profile.id === stored)
            ? stored
            : fallback;
        setActiveProfileIdState(initial);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveProfileId = useCallback((profileId: string) => {
    setActiveProfileIdState(profileId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
    }
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  const profileParam = useMemo(() => profileQuery(activeProfileId), [activeProfileId]);

  const withProfile = useCallback(
    (path: string) => {
      const joiner = path.includes("?") ? "&" : "?";
      return `${path}${joiner}${profileParam}`;
    },
    [profileParam]
  );

  const value = useMemo(
    () => ({
      profiles,
      activeProfileId,
      activeProfile,
      loading,
      setActiveProfileId,
      profileParam,
      withProfile,
    }),
    [
      profiles,
      activeProfileId,
      activeProfile,
      loading,
      setActiveProfileId,
      profileParam,
      withProfile,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}
