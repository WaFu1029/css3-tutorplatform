"use client";

import Link from "next/link";
import { cn } from "cn";
import type { Student } from "@/lib/types";
import { formatDate, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { findGaps, hoursInMonth, lastSession, monthStatus, type MonthStatus } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

/**
 * The tutor's students with this month's hours and the last session held.
 * Each row opens that student's page. `showStatus` adds where the month
 * stands (open / ready / sent / gaps), which the home page wants.
 */
export function StudentSidebar({
  students,
  activeId,
  showStatus = false,
  title = "Your students",
  className,
}: {
  students: Student[];
  activeId?: string;
  showStatus?: boolean;
  title?: string;
  className?: string;
}) {
  const { db } = useStore();
  const today = todayISO();
  const month = monthKey(today);

  return (
    <nav aria-label={title} className={className}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{monthLabel(month)}</span>
      </div>

      <ItemGroup className="gap-1.5">
        {students.map((student) => {
          const hours = hoursInMonth(db.entries, student.id, month);
          const last = lastSession(db.entries, student.id);
          const active = student.id === activeId;
          const status = monthStatus(student, month, db, today);
          const gaps = status === "gaps" ? findGaps(student, month, db.entries, today).length : 0;

          return (
            <Item
              key={student.id}
              size="sm"
              aria-current={active ? "page" : undefined}
              className={cn(
                "items-start rounded-md border bg-card hover:bg-card-hover",
                active &&
                  "border-secondary-foreground/25 bg-secondary text-secondary-foreground hover:bg-secondary",
              )}
              render={<Link href={`/students/${student.id}`} />}
            >
              <ItemContent className="gap-0.5">
                <ItemTitle className="text-sm font-medium">{student.name}</ItemTitle>
                <ItemDescription className={cn(active && "text-secondary-foreground/70")}>
                  {student.status === "stopped" && student.stoppedDate
                    ? `Stopped ${formatDate(student.stoppedDate)}`
                    : last
                      ? `Last session ${formatDate(last.date)}`
                      : "No sessions yet"}
                </ItemDescription>
              </ItemContent>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">{formatHours(hours)} h</span>
                {showStatus ? (
                  <StatusBadge status={status} gaps={gaps} />
                ) : (
                  status === "sent" && <StatusBadge status="sent" gaps={0} />
                )}
              </div>
            </Item>
          );
        })}
      </ItemGroup>
    </nav>
  );
}

export function StatusBadge({ status, gaps }: { status: MonthStatus; gaps: number }) {
  switch (status) {
    case "sent":
      return <Badge variant="outline" className="h-5 px-1.5 text-[11px]">Sent</Badge>;
    case "ready":
      return <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">Ready to send</Badge>;
    case "gaps":
      return (
        <Badge variant="destructive" className="h-5 px-1.5 text-[11px]">
          {gaps} {gaps === 1 ? "gap" : "gaps"}
        </Badge>
      );
    case "open":
      return (
        <Badge variant="ghost" className="h-5 px-1.5 text-[11px] text-muted-foreground">
          Open
        </Badge>
      );
  }
}
