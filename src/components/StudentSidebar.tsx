"use client";

import Link from "next/link";
import { cn } from "cn";
import type { Student } from "@/lib/types";
import { formatDate, formatHours, monthKey, todayISO } from "@/lib/fy";
import { hoursInMonth, lastSession, ledgerOf, monthStatus, unloggedDays } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { MonthStatusBadge } from "@/components/MonthStatusBadge";
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
 * stands, with any unlogged scheduled days counted beside it.
 */
export function StudentSidebar({
  students,
  activeId,
  showStatus = false,
  title = "Your students",
  action,
  className,
}: {
  students: Student[];
  activeId?: string;
  showStatus?: boolean;
  title?: string;
  /** Sits right-aligned on the title row, e.g. "Add a student". */
  action?: React.ReactNode;
  className?: string;
}) {
  const { db } = useStore();
  const today = todayISO();
  const month = monthKey(today);

  return (
    <nav aria-label={title} className={className}>
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {action}
      </div>

      <ItemGroup className="gap-1.5">
        {students.map((student) => {
          const hours = hoursInMonth(db.entries, student.id, month);
          const last = lastSession(db.entries, student.id);
          const active = student.id === activeId;
          const status = monthStatus(student, month, db.reports, today);
          const unlogged = unloggedDays(student, month, ledgerOf(db), today).length;

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
                  <MonthStatusBadge status={status} unlogged={unlogged} />
                ) : (
                  status === "sent" && <MonthStatusBadge status="sent" />
                )}
              </div>
            </Item>
          );
        })}
      </ItemGroup>
    </nav>
  );
}
