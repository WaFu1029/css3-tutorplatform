/**
 * Browsers that opened the prototype before the shared contract hold a cache
 * in the old shape: free-text days/times, goals keyed on the student,
 * submissions instead of month reports, single-letter absence codes. This
 * turns one into the current DB so a tutor's edits survive the upgrade.
 */

import type { DB, Goal, MonthReport, ScheduleSlot, SessionEntry, Student, Tutor } from "./types";
import { normalizeCode } from "./absence";
import { categoryOf } from "./goals";
import { WEEKDAY_SHORT } from "./schedule";

type LegacyStudent = {
  id: string;
  name: string;
  tutorId: string;
  site: string;
  days: string;
  times: string;
  startedOn: string;
  goals: Record<string, { attainedOn: string }>;
  otherGoals: { id: string; label: string; attainedOn: string | null }[];
  stopped: { on: string; reason: string } | null;
};

export type LegacyDB = {
  tutors: Tutor[];
  students: LegacyStudent[];
  entries: { id: string; studentId: string; date: string; hours: number; code: string | null; loggedAt?: string }[];
  submissions: { studentId: string; month: string; submittedAt: string }[];
};

export function isLegacy(db: unknown): db is LegacyDB {
  return typeof db === "object" && db !== null && "submissions" in db;
}

function hhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Best effort: "Tue & Thu" + "6:00–7:30 pm" → two slots. A time range it can't
 * read yields no slots rather than a wrong one; the tutor can fix the schedule.
 */
export function parseLegacySchedule(days: string, times: string): ScheduleSlot[] {
  const weekdays = WEEKDAY_SHORT.flatMap((name, i) =>
    new RegExp(`\\b${name}`, "i").test(days) ? [i] : [],
  );
  const m = times.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!m || weekdays.length === 0) return [];

  const endHalf = m[6]?.toLowerCase();
  const startHalf = m[3]?.toLowerCase() ?? endHalf;
  // 12 reads as noon either way: nobody tutors at midnight.
  const to24 = (h: number, half: string | undefined) => (half === "pm" && h < 12 ? h + 12 : h);

  const endH = to24(Number(m[4]), endHalf);
  let startH = to24(Number(m[1]), startHalf);
  // "11–1 pm" borrows pm for 11 and lands after the end; it meant morning.
  if (startH > endH && startH >= 12) startH -= 12;

  const startTime = hhmm(startH, Number(m[2] ?? 0));
  const endTime = hhmm(endH, Number(m[5] ?? 0));
  return weekdays.map((weekday) => ({ weekday, startTime, endTime }));
}

export function migrateLegacy(old: LegacyDB): DB {
  const students: Student[] = old.students.map((s) => ({
    id: s.id,
    name: s.name,
    tutorId: s.tutorId,
    site: s.site,
    schedule: parseLegacySchedule(s.days, s.times),
    startedOn: s.startedOn,
    ...(s.stopped
      ? { status: "stopped" as const, stoppedDate: s.stopped.on, stoppedReason: s.stopped.reason }
      : { status: "active" as const }),
  }));

  const entries: SessionEntry[] = old.entries.flatMap((e): SessionEntry[] => {
    const base = { id: e.id, studentId: e.studentId, date: e.date, loggedAt: e.loggedAt };
    const code = normalizeCode(e.code);
    if (code) return [{ ...base, code }];
    return e.hours > 0 ? [{ ...base, hours: e.hours }] : [];
  });

  // The old model only recorded attained goals, so each one was added and
  // attained at once as far as we know.
  const goals: Goal[] = old.students.flatMap((s) => [
    ...Object.entries(s.goals).map(
      ([code, mark]): Goal => ({
        id: `g-${s.id}-${code}`,
        studentId: s.id,
        catalogKey: code,
        category: categoryOf(code),
        addedDate: mark.attainedOn,
        attainedDate: mark.attainedOn,
      }),
    ),
    ...s.otherGoals.map(
      (g): Goal => ({
        id: g.id,
        studentId: s.id,
        customLabel: g.label,
        category: "other",
        addedDate: g.attainedOn ?? s.startedOn,
        ...(g.attainedOn ? { attainedDate: g.attainedOn } : {}),
      }),
    ),
  ]);

  const reports: MonthReport[] = old.submissions.map((sub) => ({
    studentId: sub.studentId,
    month: sub.month,
    status: "sent",
    sentAt: sub.submittedAt,
  }));

  return { tutors: old.tutors, students, entries, goals, reports };
}
