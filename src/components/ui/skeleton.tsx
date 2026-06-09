import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-muted/80 ring-1 ring-border/30",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
