"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import type { DB, ScheduleSlot, SessionEntry, Student } from "@/lib/types";
import { ABSENCE_LABEL } from "@/lib/absence";
import { dateKey, daysInMonth, formatDate, formatHours, monthLabel, todayISO, weekdayOf } from "@/lib/fy";
import { entryOn, isDismissed, slotsOn, whenWhere } from "@/lib/logic";
import { formatTime, WEEKDAY_SHORT } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export type Mark =
  | { kind: "held"; hours: number }
  | { kind: "absent"; code: NonNullable<SessionEntry["code"]> }
  | { kind: "unlogged" }
  | { kind: "dismissed" }
  | { kind: "upcoming" };

/** One student on one day: scheduled, logged, or both. */
export type Session = {
  student: Student;
  date: string;
  mark: Mark;
  /** The scheduled slot, when there is one; a logged day off-schedule has none. */
  slot: ScheduleSlot | null;
  /** Earliest start that day across the student's own slot and any group's; sorts and labels the chip. */
  firstStart: string | null;
};

export type Selection = { date: string; studentId: string | null };

/** Everyone scheduled or logged on a date, earliest start first. */
export function sessionsOn(
  students: Student[],
  date: string,
  db: Pick<DB, "entries" | "groups" | "dismissals" | "sessionDetails">,
  today: string = todayISO(),
): Session[] {
  const out: Session[] = [];
  for (const student of students) {
    const entry = entryOn(db.entries, student.id, date);
    const slots = slotsOn(student, date, db.groups);
    let mark: Mark | null = null;
    if (entry?.code) mark = { kind: "absent", code: entry.code };
    else if (entry) mark = { kind: "held", hours: entry.hours ?? 0 };
    else if (slots.length === 0) mark = null;
    else if (date >= today) mark = { kind: "upcoming" };
    else if (isDismissed(db.dismissals, student.id, date)) mark = { kind: "dismissed" };
    else mark = { kind: "unlogged" };
    if (mark) {
      // A session moved for the day shows (and sorts by) its own time.
      const own = whenWhere(student, date, db);
      const slot = slots[0]?.slot ?? null;
      out.push({
        student,
        date,
        mark,
        slot:
          own.startTime && own.endTime
            ? { weekday: slot?.weekday ?? 0, startTime: own.startTime, endTime: own.endTime }
            : slot,
        firstStart:
          [own.startTime, ...slots.slice(1).map((s) => s.slot.startTime)]
            .filter((t): t is string => Boolean(t))
            .sort()[0] ?? null,
      });
    }
  }
  return out.sort((a, b) => (a.firstStart ?? "").localeCompare(b.firstStart ?? ""));
}

/**
 * Every student on one month grid: what was held, missed or still unlogged on
 * each day, and what's coming up. Picking a name or a day hands it to the
 * session panel beside the calendar.
 */
export function StudentsCalendar({
  students,
  months,
  month,
  onMonthChange,
  selected,
  onSelect,
}: {
  students: Student[];
  months: string[];
  month: string;
  onMonthChange: (month: string) => void;
  /** Null when nothing is picked: no day is highlighted. */
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const { db } = useStore();
  const today = todayISO();
  const at = months.indexOf(month);

  // First names read faster in a small cell; fall back to the full name when two share one.
  const firstNames = new Map(students.map((s) => [s.id, s.name.split(" ")[0]]));
  const shortName = (s: Student) => {
    const first = firstNames.get(s.id)!;
    return [...firstNames.values()].filter((n) => n === first).length > 1 ? s.name : first;
  };

  const section = useRef<HTMLElement>(null);
  const fitHeight = useFitToViewport(section);

  const days = daysInMonth(month);
  const leading = weekdayOf(dateKey(month, 1));
  const trailing = (7 - ((leading + days) % 7)) % 7;

  return (
    // On large screens, tall enough to end just above the bottom of the window
    // when the page is scrolled to the top; the week rows share the height.
    <section
      ref={section}
      aria-label="Calendar of all students"
      style={fitHeight ? { minHeight: fitHeight } : undefined}
      className="flex flex-col overflow-hidden rounded-xl bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onMonthChange(months[at - 1])}
            disabled={at <= 0}
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="min-w-[9rem] text-center text-lg leading-none font-medium" aria-live="polite">
            {monthLabel(month)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onMonthChange(months[at + 1])}
            disabled={at >= months.length - 1}
            aria-label="Next month"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <Legend />
      </div>

      <div className="flex flex-1 flex-col overflow-x-auto">
        <div className="flex min-w-[600px] flex-1 flex-col">
          <div className="grid grid-cols-7 border-b bg-muted/40" aria-hidden>
            {WEEKDAY_SHORT.map((day) => (
              <div key={day} className="py-1.5 text-center text-[11px] font-semibold text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <ol className="grid flex-1 auto-rows-fr grid-cols-7">
            {Array.from({ length: leading }, (_, i) => (
              <li key={`lead-${i}`} aria-hidden className="border-r border-b bg-muted/30" />
            ))}

            {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
              const date = dateKey(month, day);
              const sessions = sessionsOn(students, date, db, today);
              const isToday = date === today;
              const isSelectedDay = selected?.date === date;
              return (
                <li
                  key={date}
                  data-day={date}
                  onClick={() => onSelect({ date, studentId: sessions[0]?.student.id ?? null })}
                  className={cn(
                    "min-h-[84px] cursor-pointer border-r border-b bg-input-surface p-1 transition-colors hover:bg-lime/10",
                    isToday && "ring-1 ring-primary ring-inset",
                    isSelectedDay && "bg-lime/20 ring-2 ring-primary ring-inset hover:bg-lime/20",
                  )}
                >
                  <button
                    type="button"
                    aria-label={`${formatDate(date)}, ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
                    aria-pressed={isSelectedDay}
                    className={cn(
                      "block rounded-sm px-0.5 text-[11px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isToday || isSelectedDay ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {day}
                  </button>
                  {sessions.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {sessions.map((s) => (
                        <li key={s.student.id}>
                          <SessionChip
                            session={s}
                            name={shortName(s.student)}
                            selected={isSelectedDay && selected?.studentId === s.student.id}
                            onSelect={() => onSelect({ date, studentId: s.student.id })}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}

            {Array.from({ length: trailing }, (_, i) => (
              <li key={`trail-${i}`} aria-hidden className="border-r border-b bg-muted/30" />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function markLabel(session: Session): string {
  const { mark } = session;
  switch (mark.kind) {
    case "held":
      return `${formatHours(mark.hours)} ${mark.hours === 1 ? "hour" : "hours"} held`;
    case "absent":
      return ABSENCE_LABEL[mark.code];
    case "upcoming":
      return session.firstStart ? `Scheduled ${formatTime(session.firstStart)}` : "Scheduled";
    case "unlogged":
      return "Not logged yet";
    case "dismissed":
      return "Nothing to record";
  }
}

function SessionChip({
  session,
  name,
  selected,
  onSelect,
}: {
  session: Session;
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { mark } = session;
  const detail =
    mark.kind === "held"
      ? `${formatHours(mark.hours)}h`
      : mark.kind === "absent"
        ? mark.code
        : mark.kind === "upcoming"
          ? session.firstStart
            ? formatTime(session.firstStart).replace(":00", "")
            : ""
          : mark.kind === "unlogged"
            ? "?"
            : "—";

  return (
    <button
      type="button"
      onClick={(e) => {
        // The cell's own click would reselect the day's first session.
        e.stopPropagation();
        onSelect();
      }}
      aria-pressed={selected}
      aria-label={`${session.student.name}, ${formatDate(session.date)}: ${markLabel(session)}`}
      title={`${session.student.name} · ${markLabel(session)}`}
      className={cn(
        "flex w-full items-center justify-between gap-1 rounded-sm px-1.5 py-0.5 text-left text-xs leading-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mark.kind === "held" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        mark.kind === "absent" && "bg-muted text-muted-foreground hover:bg-muted-hover",
        mark.kind === "unlogged" &&
          "border border-dashed border-foreground/30 text-foreground hover:bg-muted/60",
        mark.kind === "dismissed" && "text-muted-foreground/70 line-through hover:bg-muted/60",
        mark.kind === "upcoming" && "text-muted-foreground hover:bg-muted/60",
      )}
    >
      <span className="truncate font-medium">{name}</span>
      <span className="shrink-0 tabular-nums">{detail}</span>
    </button>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-sm bg-secondary" /> Held
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-sm bg-muted" /> TA / SA / H
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-sm border border-dashed border-foreground/35" /> Unlogged
      </li>
    </ul>
  );
}

/** Space between the calendar's bottom edge and the window's, at the top of the page. */
const BOTTOM_GAP = 24;
/** Below this the calendar keeps its natural height; the week rows would get cramped. */
const MIN_FIT = 480;

/**
 * The height that takes an element from where it sits on the page (scrolled
 * to the top) to just above the bottom of the window. Large screens only;
 * re-measured on resize, since the header above it can wrap.
 */
function useFitToViewport(ref: React.RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    function measure() {
      const el = ref.current;
      if (!el || !wide.matches) return setHeight(null);
      const top = el.getBoundingClientRect().top + window.scrollY;
      const fit = window.innerHeight - top - BOTTOM_GAP;
      setHeight(fit >= MIN_FIT ? fit : null);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref]);

  return height;
}
