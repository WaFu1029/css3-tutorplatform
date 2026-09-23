/**
 * One row per student per month, the shape both the tutor and staff views
 * read. Status and unlogged days come from the shared logic in `lib/logic`.
 */

import type { DB, Student } from "@/lib/types";
import { formatDate, formatHours, monthKey, todayISO } from "@/lib/fy";
import { goalText, isStarred } from "@/lib/goals";
import {
  expectsReport,
  ledgerOf,
  monthStatus,
  monthSummary,
  reportFor,
  slotsOn,
  whenWhere,
  type MonthStatus,
} from "@/lib/logic";

export type AttainedGoal = { label: string; starred: boolean; on: string };

export type ReportRow = {
  student: Student;
  tutorName: string;
  hours: number;
  sessions: number;
  missed: number;
  /** Unlogged scheduled days: shown beside the status, never part of it. */
  unlogged: string[];
  status: MonthStatus;
  sentAt: string | null;
  attained: AttainedGoal[];
  stoppedThisMonth: { on: string; reason: string } | null;
};

function stopIn(student: Student, month: string): { on: string; reason: string } | null {
  if (student.status !== "stopped" || !student.stoppedDate) return null;
  if (monthKey(student.stoppedDate) !== month) return null;
  return { on: student.stoppedDate, reason: student.stoppedReason ?? "" };
}

function attainedIn(db: DB, studentId: string, month: string): AttainedGoal[] {
  return db.goals
    .filter((g) => g.studentId === studentId && g.attainedDate && monthKey(g.attainedDate) === month)
    .map((g) => ({ label: goalText(g), starred: isStarred(g), on: g.attainedDate as string }))
    .sort((a, b) => a.on.localeCompare(b.on));
}

export function buildRows(
  db: DB,
  students: Student[],
  month: string,
  today: string = todayISO(),
): ReportRow[] {
  const tutorName = new Map(db.tutors.map((t) => [t.id, t.name]));
  const ledger = ledgerOf(db);

  return students
    .filter((s) => expectsReport(s, month))
    .map((student) => {
      const summary = monthSummary(student, month, ledger, today);
      const report = reportFor(db.reports, student.id, month);
      const status = monthStatus(student, month, db.reports, today);
      const sent = status === "sent";
      return {
        student,
        tutorName: tutorName.get(student.tutorId) ?? "Unassigned",
        ...summary,
        status,
        sentAt: sent ? (report?.sentAt ?? null) : null,
        attained: attainedIn(db, student.id, month),
        stoppedThisMonth: stopIn(student, month),
      };
    })
    .sort(
      (a, b) =>
        a.tutorName.localeCompare(b.tutorName) || a.student.name.localeCompare(b.student.name),
    );
}

/** "Sep 2, 9, 16" — month named once, since every date shares it. */
export function shortDates(dates: string[], max = 4): string {
  if (dates.length === 0) return "";
  const [first, ...rest] = dates;
  const head = formatDate(first).replace(/, \d{4}$/, "");
  const tail = rest.slice(0, max - 1).map((d) => String(Number(d.slice(8))));
  const more = dates.length > max ? ` +${dates.length - max} more` : "";
  return [head, ...tail].join(", ") + more;
}

/** The student page, scrolled to the month. Session 2 owns the target. */
export function studentMonthHref(studentId: string, month: string): string {
  return `/students/${studentId}?month=${month}#month-${month}`;
}

/**
 * A student's year sheet, or given `month` that month's sheet. `fy` picks a
 * year sheet other than the current fiscal year's.
 */
export function sheetHref(
  studentId: string,
  print = false,
  month?: string,
  fy?: number,
): string {
  const query = new URLSearchParams();
  if (fy !== undefined && !month) query.set("fy", String(fy));
  if (print) query.set("print", "1");
  const qs = query.toString();
  return `/students/${studentId}/sheet${month ? `/${month}` : ""}${qs ? `?${qs}` : ""}`;
}

/* ---------- export ---------- */

function toCsv(rows: string[][]): string {
  return rows
    .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export function downloadCsv(filename: string, rows: string[][]) {
  // The BOM lets Excel read names like "Héctor" as UTF-8.
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * One line per logged day for the month's students, as the paper form's
 * attendance grid would record it, plus what the app knows beyond the form:
 * the session's own time and place, any group meeting that day, and the
 * tutor's note.
 */
export function sessionsCsv(rows: ReportRow[], db: DB, month: string): string[][] {
  const byId = new Map(rows.map((r) => [r.student.id, r]));
  return [
    ["Date", "Tutor", "Student", "Start", "End", "Site", "Hours", "Code", "Group", "Note"],
    ...db.entries
      .filter((e) => byId.has(e.studentId) && monthKey(e.date) === month)
      .sort((a, b) => a.date.localeCompare(b.date) || a.studentId.localeCompare(b.studentId))
      .map((e) => {
        const r = byId.get(e.studentId)!;
        const where = whenWhere(r.student, e.date, db);
        const groups = slotsOn(r.student, e.date, db.groups)
          .flatMap((s) => (s.group ? [s.group.name] : []))
          .join("; ");
        return [
          e.date,
          r.tutorName,
          r.student.name,
          where.startTime ?? "",
          where.endTime ?? "",
          where.site,
          e.hours === undefined ? "" : formatHours(e.hours),
          e.code ?? "",
          groups,
          e.note ?? "",
        ];
      }),
  ];
}

/**
 * Fiscal years with anything on record, newest first, always including the
 * current one: the choices for the Year picker.
 */
export function reportYears(db: DB, current: number): number[] {
  const dates = [
    ...db.students.map((s) => s.startedOn).filter((d): d is string => Boolean(d)),
    ...db.entries.map((e) => e.date),
  ];
  const fyOf = (date: string) => {
    const [y, m] = date.split("-").map(Number);
    return m >= 7 ? y : y - 1;
  };
  const earliest = Math.min(current, ...dates.map(fyOf));
  return Array.from({ length: current - earliest + 1 }, (_, i) => current - i);
}
