import * as React from "react"

import { cn } from "./cn"

// Base pulse block. Greyed, rounded, matches the neutral `--muted` token so it
// reads as "content loading here" without introducing a new color. Layout is
// driven entirely by the className passed in (height/width/shape).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// A short stack of text-line skeletons. The last line is narrower so it reads as
// a paragraph rather than a solid block.
function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4 w-full", i === lines - 1 && "w-2/3")}
        />
      ))}
    </div>
  )
}

// Generic content-card skeleton: a title bar over a few text lines, framed like
// the real cards (border + bg-card) so the grid footprint matches before content
// swaps in.
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <Skeleton className="h-5 w-1/2" />
      <SkeletonText lines={3} className="mt-4" />
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonCard }
