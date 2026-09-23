"use client";

import { CalendarCheckIcon } from "lucide-react";
import { cn } from "cn";
import type { Student } from "@/lib/types";
import { formatDate, todayISO, weekdayOf } from "@/lib/fy";
import { entryOn, whenWhere } from "@/lib/logic";
import { formatSlotTime, WEEKDAY_SHORT } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { GroupAppointments } from "@/components/GroupAppointments";
import { markLabel, sessionsOn, type Selection } from "@/app/_components/StudentsCalendar";

/**
 * The picked day on a tutor's calendar, for staff: every session that day
 * with its time, place, what was logged and the tutor's note. Nothing here
 * edits; tutors log their own sessions.
 */
export function ReadOnlyDay({ students, selected }: { students: Student[]; selected: Selection }) {
  const { db } = useStore();
  const { date } = selected;
  const sessions = sessionsOn(students, date, db, todayISO());

  return (
    <aside aria-label="Day" className="space-y-4 rounded-xl bg-card p-4 text-sm">
      <div>
        <h2 className="font-medium">
          {date === todayISO() ? "Today" : WEEKDAY_SHORT[weekdayOf(date)]}
        </h2>
        <p className="text-muted-foreground">{formatDate(date)}</p>
      </div>

      {sessions.length === 0 ? (
        <p className="flex items-start gap-2 text-muted-foreground">
          <CalendarCheckIcon className="mt-0.5 size-4 shrink-0" />
          Nothing scheduled or logged this day.
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const where = whenWhere(s.student, date, db);
            const time =
              where.startTime && where.endTime
                ? formatSlotTime({ weekday: 0, startTime: where.startTime, endTime: where.endTime })
                : null;
            const note = entryOn(db.entries, s.student.id, date)?.note;
            const picked = selected.studentId === s.student.id;
            return (
              <li
                key={s.student.id}
                className={cn(
                  "rounded-lg border bg-input-surface px-3 py-2.5",
                  picked && "border-primary ring-1 ring-primary",
                )}
              >
                <p className="font-medium">{s.student.name}</p>
                <p className="text-xs text-muted-foreground">
                  {time ? `${time} · ` : ""}
                  {where.site}
                  {where.changed && <span className="italic"> · changed for this session</span>}
                </p>
                <GroupAppointments student={s.student} date={date} />
                <p
                  className={cn(
                    "mt-1.5",
                    s.mark.kind === "unlogged" ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {markLabel(s)}
                </p>
                {note && (
                  <p className="mt-1.5 border-l-2 pl-2 text-xs text-muted-foreground italic">{note}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">Read only. Tutors log their own sessions.</p>
    </aside>
  );
}
