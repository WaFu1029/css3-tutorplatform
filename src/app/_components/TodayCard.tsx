"use client";

import { toast } from "sonner";
import { CalendarCheckIcon } from "lucide-react";
import type { AbsenceCode, Student } from "@/lib/types";
import { ABSENCE_CODES, ABSENCE_LABEL } from "@/lib/absence";
import { addDays, formatDate, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { entryOn, isMonthSent, scheduledHours, slotOn } from "@/lib/logic";
import { formatSlotTime } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Sessions on the schedule for today, each loggable in one tap. */
export function TodayCard({ students }: { students: Student[] }) {
  const { db, saveEntries, clearEntry, reopenMonth } = useStore();
  const today = todayISO();
  const month = monthKey(today);
  const due = students
    .filter((s) => slotOn(s, today))
    .sort((a, b) => slotOn(a, today)!.startTime.localeCompare(slotOn(b, today)!.startTime));

  function log(student: Student, value: { hours: number } | { code: AbsenceCode }) {
    saveEntries([student.id], today, value);
    toast.success(
      "code" in value ? `${ABSENCE_LABEL[value.code]} recorded` : `${formatHours(value.hours)} hours saved`,
      { description: `${student.name} · today` },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Today</CardTitle>
        <CardDescription>{formatDate(today)}</CardDescription>
      </CardHeader>
      <CardContent>
        {due.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheckIcon className="size-4" />
            Nothing on the schedule today.{" "}
            {nextSession(students, today) ?? ""}
          </p>
        ) : (
          <ul className="divide-y">
            {due.map((student) => {
              const slot = slotOn(student, today)!;
              const hours = scheduledHours(student, today)!;
              const entry = entryOn(db.entries, student.id, today);
              const sent = isMonthSent(db.reports, student.id, month);

              return (
                <li
                  key={student.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSlotTime(slot)} · {student.site}
                    </p>
                  </div>

                  {sent ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {monthLabel(month).split(" ")[0]} is sent.
                      <Button variant="link" size="sm" className="h-auto px-0" onClick={() => reopenMonth(student.id, month)}>
                        Reopen
                      </Button>
                    </div>
                  ) : entry ? (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium">
                        {entry.code ? ABSENCE_LABEL[entry.code] : `Held · ${formatHours(entry.hours)} h`}
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-muted-foreground"
                        onClick={() => clearEntry(student.id, today)}
                      >
                        Undo
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" onClick={() => log(student, { hours })}>
                        Held · {formatHours(hours)} h
                      </Button>
                      {ABSENCE_CODES.map((code) => (
                        <Button
                          key={code}
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => log(student, { code })}
                        >
                          {ABSENCE_LABEL[code]}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** "Next: Luis on Sat, Sep 26." within the coming two weeks, else null. */
function nextSession(students: Student[], today: string): string | null {
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i);
    const who = students.filter((s) => slotOn(s, date));
    if (who.length) {
      return `Next: ${who.map((s) => s.name.split(" ")[0]).join(", ")} on ${formatDate(date)}.`;
    }
  }
  return null;
}
