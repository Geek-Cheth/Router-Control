"use client";

import { ProfileProvider } from "@/hooks/use-profile";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>;
}
