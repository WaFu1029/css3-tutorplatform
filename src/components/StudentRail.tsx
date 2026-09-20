"use client";

import { cn } from "cn";
import type { DB, Student } from "@/lib/types";
import { formatDate, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { hoursInMonth, isSubmitted, lastEntryFor } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

export function StudentRail({
  students,
  db,
  activeId,
  onPick,
}: {
  students: Student[];
  db: DB;
  activeId: string;
  onPick: (id: string) => void;
}) {
  const current = monthKey(todayISO());

  return (
    <nav aria-label="Your students">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Your students</h2>
        <span className="text-xs text-muted-foreground">{monthLabel(current)}</span>
      </div>

      <ItemGroup className="gap-1.5">
        {students.map((student) => {
          const hours = hoursInMonth(db.entries, student.id, current);
          const last = lastEntryFor(db.entries, student.id);
          const sent = isSubmitted(db, student.id, current);
          const active = student.id === activeId;

          return (
            <Item
              key={student.id}
              size="sm"
              aria-current={active ? "true" : undefined}
              className={cn(
                // Each row is its own card, so the rail reads as a stack of
                // students rather than text floating on the page.
                "cursor-pointer items-start rounded-md border bg-card hover:bg-card-hover",
                active &&
                  "border-secondary-foreground/25 bg-secondary text-secondary-foreground hover:bg-secondary",
              )}
              render={<button type="button" onClick={() => onPick(student.id)} />}
            >
              <ItemContent className="gap-0.5">
                <ItemTitle className="text-sm font-medium">{student.name}</ItemTitle>
                <ItemDescription className={cn(active && "text-secondary-foreground/70")}>
                  {student.stopped
                    ? `Stopped ${formatDate(student.stopped.on)}`
                    : last
                      ? `Last session ${formatDate(last.date)}`
                      : "No sessions yet"}
                </ItemDescription>
              </ItemContent>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">
                  {formatHours(hours)} h
                </span>
                {sent && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                    sent
                  </Badge>
                )}
              </div>
            </Item>
          );
        })}
      </ItemGroup>
    </nav>
  );
}
