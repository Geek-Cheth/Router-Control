"use client";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { ChevronDown, Router } from "lucide-react";
import { useState } from "react";

export function ProfileSwitcher({ className }: { className?: string }) {
  const { profiles, activeProfile, activeProfileId, setActiveProfileId, loading } =
    useProfile();
  const [open, setOpen] = useState(false);

  if (loading || profiles.length <= 1) return null;

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className="h-8 gap-1.5 border-border/50 px-2.5 font-mono text-[11px] uppercase tracking-wide"
      >
        <Router className="h-3.5 w-3.5 text-cyan-400" />
        <span>{activeProfile?.name ?? "Router"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close profile menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 min-w-[10rem] rounded border border-border/50 bg-background p-1 shadow-lg">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  setActiveProfileId(profile.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full flex-col rounded px-2.5 py-2 text-left transition-colors hover:bg-muted/50",
                  profile.id === activeProfileId && "bg-muted/40"
                )}
              >
                <span className="text-xs font-medium text-foreground">{profile.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {profile.host}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
