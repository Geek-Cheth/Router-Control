"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";

interface EmptyStateProps {
  variant: "waiting" | "error";
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function EmptyState({
  variant,
  message,
  onRetry,
  retrying,
}: EmptyStateProps) {
  if (variant === "error") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="w-full max-w-lg rounded border border-destructive/25 bg-card/40 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-destructive/30 bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Connection Error
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                  {message ?? "Failed to connect to router"}
                </p>
              </div>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  disabled={retrying}
                  className="h-8 border-border/50 font-mono text-[11px] uppercase tracking-wide"
                >
                  <RefreshCw
                    className={`mr-1.5 h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`}
                  />
                  Retry connection
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full border border-cyan-400/20 bg-cyan-400/5 animate-pulse"
            aria-hidden
          />
          <span
            className="absolute inset-2 rounded-full border border-cyan-400/15 animate-pulse [animation-delay:400ms]"
            aria-hidden
          />
          <div className="relative flex h-12 w-12 items-center justify-center rounded border border-border/50 bg-card/60">
            <WifiOff className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <p className="text-sm font-medium tracking-tight">
          Waiting for router connection
        </p>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {message ?? "Fetching data from your router..."}
        </p>
      </div>
    </div>
  );
}
