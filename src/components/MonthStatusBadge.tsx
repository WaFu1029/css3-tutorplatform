import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { MONTH_STATUS_LABEL, type MonthStatus } from "@/lib/logic";
import { Badge } from "@/components/ui/badge";

/**
 * A month's status, with the count of unlogged scheduled days beside it.
 * The count is a gentle prompt, never part of the status.
 */
export function MonthStatusBadge({
  status,
  unlogged = 0,
  className,
}: {
  status: MonthStatus;
  unlogged?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center justify-end gap-1", className)}>
      <Badge
        variant={status === "sent" ? "default" : status === "open" ? "outline" : "ghost"}
        className={cn(status === "not-started" && "text-muted-foreground")}
      >
        {status === "sent" && <CheckIcon />}
        {MONTH_STATUS_LABEL[status]}
      </Badge>
      {unlogged > 0 && status !== "sent" && <UnloggedCount n={unlogged} />}
    </span>
  );
}

/** "3 unlogged": soft, not an error. */
export function UnloggedCount({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-4xl border border-dashed border-foreground/25 px-1.5 text-[11px] text-muted-foreground tabular-nums",
        className,
      )}
    >
      {n} unlogged
    </span>
  );
}
