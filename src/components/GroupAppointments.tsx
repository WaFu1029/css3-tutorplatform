"use client";

import { UsersIcon } from "lucide-react";
import type { Student } from "@/lib/types";
import { slotsOn } from "@/lib/logic";
import { formatSlotTime } from "@/lib/schedule";
import { useStore } from "@/lib/store";

/**
 * The student's group meetings on a date, under the session's own time and
 * place. A student can have their own slot and a group's on the same day
 * (Rosa on Wednesdays); both are listed. When the day's first slot is the
 * group's, its time is already on the line above, so only the name shows.
 */
export function GroupAppointments({ student, date }: { student: Student; date: string }) {
  const { db } = useStore();
  const lines = slotsOn(student, date, db.groups).flatMap((s, i) => {
    if (!s.group) return [];
    return [{ key: `${s.group.id}-${i}`, name: s.group.name, time: i === 0 ? null : formatSlotTime(s.slot) }];
  });
  if (lines.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {lines.map((l) => (
        <li key={l.key} className="flex items-center gap-1">
          <UsersIcon className="size-3 shrink-0" />
          <span>
            <span className="font-medium text-foreground/80">{l.name}</span>
            {l.time && ` · ${l.time}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
