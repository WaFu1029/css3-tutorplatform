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
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground">
          Your students
        </h2>
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
              variant="outline"
              aria-current={active ? "true" : undefined}
              className={cn(
                "cursor-pointer items-start bg-card hover:bg-muted",
                active && "border-ink bg-lime hover:bg-lime",
              )}
              render={<button type="button" onClick={() => onPick(student.id)} />}
            >
              <ItemContent className="gap-0.5">
                <ItemTitle className="text-sm">{student.name}</ItemTitle>
                <ItemDescription className={cn(active && "text-ink/70")}>
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
                  <Badge variant={active ? "default" : "secondary"} className="h-4 px-1.5 text-[10px]">
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
