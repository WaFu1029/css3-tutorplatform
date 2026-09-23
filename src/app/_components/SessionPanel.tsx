"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRightIcon, CalendarCheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import type { AbsenceCode, Student } from "@/lib/types";
import { ABSENCE_CODES, ABSENCE_LABEL } from "@/lib/absence";
import { addDays, formatDate, formatHours, monthKey, monthLabel, todayISO, weekdayOf } from "@/lib/fy";
import { entryOn, heldHours, isMonthSent, ledgerOf } from "@/lib/logic";
import { WEEKDAY_SHORT } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useConfirmOverwrite } from "@/components/ConfirmOverwrite";
import { markLabel, sessionsOn, type Selection, type Session } from "./StudentsCalendar";
import { LogSessionForm } from "./LogSessionForm";
import { SessionGoals } from "./SessionGoals";
import { SessionNote } from "./SessionNote";
import { SessionWhenWhere } from "./SessionWhenWhere";
import { GroupAppointments } from "@/components/GroupAppointments";

/**
 * The day picked on the calendar (today until something else is picked), one
 * session at a time, with the one-tap answers: held, tutor absent, student
 * absent, holiday. Several sessions that day are stepped through with the
 * name tabs or the arrows.
 */
export function SessionPanel({
  students,
  selected,
  onSelect,
}: {
  students: Student[];
  selected: Selection;
  onSelect: (selection: Selection) => void;
}) {
  const { db } = useStore();
  const today = todayISO();
  const { date } = selected;
  const sessions = sessionsOn(students, date, db, today);
  const at = Math.max(0, sessions.findIndex((s) => s.student.id === selected.studentId));
  const current = sessions[at];
  const n = sessions.length;
  // The day the tutor opened "Log a session" for; picking another day closes it.
  const [loggingOn, setLoggingOn] = useState<string | null>(null);
  const canLog = date <= today;
  // A day with nothing scheduled has nothing else to show, so the form is simply open.
  const logging = canLog && (loggingOn === date || n === 0);

  const heading =
    date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : date === addDays(today, 1) ? "Tomorrow" : WEEKDAY_SHORT[weekdayOf(date)];

  // "Log a session" on a day that has sessions swaps in a card of its own;
  // Back returns here, asking first if anything was picked.
  if (logging && n > 0) {
    return (
      <aside aria-label="Log a session" className="flex flex-col gap-4 rounded-xl bg-card p-4">
        <LogSessionForm
          key={date}
          students={students.filter((s) => s.status === "active")}
          date={date}
          onBack={() => setLoggingOn(null)}
          onCancel={() => setLoggingOn(null)}
          onLogged={(studentId) => {
            setLoggingOn(null);
            onSelect({ date, studentId });
          }}
        />
      </aside>
    );
  }

  return (
    <aside aria-label="Session" className="flex flex-col gap-4 rounded-xl bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{heading}</h2>
          <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {canLog && !logging && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setLoggingOn(date)}
            >
              <PlusIcon /> Log a session
            </Button>
          )}
          {date !== today && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onSelect({ date: today, studentId: null })}
            >
              Back to today
            </Button>
          )}
        </div>
      </div>

      {logging && (
        <LogSessionForm
          key={date}
          students={students.filter((s) => s.status === "active")}
          date={date}
          onLogged={(studentId) => onSelect({ date, studentId })}
        />
      )}

      {n === 0 ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CalendarCheckIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Nothing on the schedule {date === today ? "today" : "this day"}.{" "}
            {nextSession(students, db, date, today)}
          </span>
        </p>
      ) : (
        <>
          {n > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Previous session"
                onClick={() => onSelect({ date, studentId: sessions[(at - 1 + n) % n].student.id })}
              >
                <ChevronLeftIcon />
              </Button>
              <div role="tablist" aria-label="Sessions this day" className="flex min-w-0 flex-1 flex-wrap gap-1">
                {sessions.map((s, i) => (
                  <button
                    key={s.student.id}
                    type="button"
                    role="tab"
                    aria-selected={i === at}
                    onClick={() => onSelect({ date, studentId: s.student.id })}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === at ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {s.student.name.split(" ")[0]}
                    {s.mark.kind === "unlogged" && <span aria-label=", not logged"> ?</span>}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Next session"
                onClick={() => onSelect({ date, studentId: sessions[(at + 1) % n].student.id })}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          )}

          <SessionDetail key={`${current.student.id}:${date}`} session={current} />
        </>
      )}
    </aside>
  );
}

function SessionDetail({ session }: { session: Session }) {
  const { db, saveEntries, setEntryNote, clearEntry, reopenMonth, dismissDay, undismissDay } = useStore();
  const { student, date, mark } = session;
  const today = todayISO();
  const month = monthKey(date);
  const sent = isMonthSent(db.reports, student.id, month);
  const hours = heldHours(student, date, ledgerOf(db));
  const when = `${student.name} · ${date === today ? "today" : formatDate(date)}`;
  const logged = mark.kind === "held" || mark.kind === "absent";
  const existing = entryOn(db.entries, student.id, date);
  const { guard, dialog } = useConfirmOverwrite(student.name);

  function log(value: { hours: number } | { code: AbsenceCode }) {
    guard(date, existing, value, () => {
      saveEntries([student.id], date, value);
      toast.success(
        "code" in value ? `${ABSENCE_LABEL[value.code]} recorded` : `${formatHours(value.hours)} hours saved`,
        { description: when },
      );
    });
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div>
        <p className="font-medium">{student.name}</p>
        <SessionWhenWhere key={`${student.id}:${date}`} student={student} date={date} locked={sent} />
        <GroupAppointments student={student} date={date} />
        <p
          className={cn(
            "mt-2 text-sm",
            mark.kind === "unlogged" ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {markLabel(session)}
        </p>
      </div>

      {sent ? (
        <p className="text-sm text-muted-foreground">
          {monthLabel(month).split(" ")[0]} is confirmed.{" "}
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => reopenMonth(student.id, month)}>
            Reopen
          </Button>
        </p>
      ) : date > today ? (
        <p className="text-sm text-muted-foreground">Log it on the day.</p>
      ) : mark.kind === "dismissed" ? (
        <Button variant="outline" size="sm" onClick={() => undismissDay(student.id, date)}>
          Undo — log this day
        </Button>
      ) : (
        <div className="space-y-2">
          <Button
            className="w-full"
            variant={mark.kind === "held" ? "secondary" : "default"}
            aria-pressed={mark.kind === "held"}
            onClick={() => log({ hours })}
          >
            Held · {formatHours(mark.kind === "held" ? mark.hours : hours)} h
          </Button>
          <div className="grid grid-cols-3 gap-1.5">
            {ABSENCE_CODES.map((code) => {
              const on = mark.kind === "absent" && mark.code === code;
              return (
                <Button
                  key={code}
                  size="sm"
                  variant={on ? "secondary" : "outline"}
                  aria-pressed={on}
                  title={ABSENCE_LABEL[code]}
                  onClick={() => log({ code })}
                >
                  {code}
                  <span className="sr-only"> — {ABSENCE_LABEL[code]}</span>
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">TA tutor absent · SA student absent · H holiday</p>
          {logged ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-muted-foreground"
              onClick={() => guard(date, existing, null, () => clearEntry(student.id, date))}
            >
              Clear this day
            </Button>
          ) : (
            mark.kind === "unlogged" && (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-muted-foreground"
                onClick={() => {
                  dismissDay(student.id, date);
                  toast("Nothing to record", {
                    description: when,
                    action: { label: "Undo", onClick: () => undismissDay(student.id, date) },
                  });
                }}
              >
                Nothing to record
              </Button>
            )
          )}
        </div>
      )}

      <SessionGoals student={student} date={date} />

      <SessionNote
        fieldId={`note-${student.id}-${date}`}
        note={existing?.note ?? ""}
        logged={Boolean(existing)}
        onSave={(note) => setEntryNote(student.id, date, note)}
      />

      <Button
        variant="link"
        size="sm"
        className="h-auto px-0"
        nativeButton={false}
        render={<Link href={`/students/${student.id}?month=${month}#month-${month}`} />}
      >
        Open {student.name.split(" ")[0]}&apos;s page <ArrowRightIcon />
      </Button>
    </div>
  );
}

/** "Next: Luis on Sep 26." within the coming two weeks of `from`, else "". */
function nextSession(
  students: Student[],
  db: Parameters<typeof sessionsOn>[2],
  from: string,
  today: string,
): string {
  for (let i = 1; i <= 14; i++) {
    const date = addDays(from, i);
    const who = sessionsOn(students, date, db, today).map((s) => s.student.name.split(" ")[0]);
    if (who.length) return `Next: ${who.join(", ")} on ${formatDate(date)}.`;
  }
  return "";
}
