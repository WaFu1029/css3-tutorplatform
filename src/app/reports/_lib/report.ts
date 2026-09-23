/**
 * One row per student per month, the shape both the tutor and staff views
 * read. Gap and send rules come from the shared logic in `lib/logic`.
 */

import type { DB, SessionEntry, Student } from "@/lib/types";
import { formatDate, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { goalText, isStarred } from "@/lib/goals";
import { canSend, expectsReport, monthSummary, reportFor } from "@/lib/logic";

/**
 * The task's vocabulary for this tab, which differs from `MonthStatus` in
 * lib/logic (there "open" means no gaps with sessions still ahead):
 * - open: scheduled sessions still unlogged, cannot send yet
 * - ready: nothing missing, waiting for the tutor to send
 * - sent: with the office
 * - upcoming: the month has not started, nothing to report
 */
export type ReportStatus = "open" | "ready" | "sent" | "upcoming";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  open: "Open",
  ready: "Ready",
  sent: "Sent",
  upcoming: "Not started",
};

export type AttainedGoal = { label: string; starred: boolean; on: string };

export type ReportRow = {
  student: Student;
  tutorName: string;
  hours: number;
  sessions: number;
  missed: number;
  gaps: string[];
  status: ReportStatus;
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
  const upcoming = month > monthKey(today);

  return students
    .filter((s) => expectsReport(s, month))
    .map((student) => {
      const summary = monthSummary(student, month, db.entries, today);
      const report = reportFor(db.reports, student.id, month);
      const sent = report?.status === "sent";
      const status: ReportStatus = sent
        ? "sent"
        : upcoming
          ? "upcoming"
          : canSend(student, month, db.entries, today)
            ? "ready"
            : "open";
      return {
        student,
        tutorName: tutorName.get(student.tutorId) ?? "Unassigned",
        ...summary,
        status,
        sentAt: sent ? (report.sentAt ?? null) : null,
        attained: attainedIn(db, student.id, month),
        stoppedThisMonth: stopIn(student, month),
      };
    })
    .sort(
      (a, b) =>
        a.tutorName.localeCompare(b.tutorName) || a.student.name.localeCompare(b.student.name),
    );
}

/** Why a row was left out of "Send all ready", in words a tutor can act on. */
export function skipReason(row: ReportRow): string | null {
  switch (row.status) {
    case "open": {
      const n = row.gaps.length;
      return `${n} scheduled session${n === 1 ? "" : "s"} not logged (${shortDates(row.gaps)})`;
    }
    case "upcoming":
      return "month has not started";
    default:
      return null;
  }
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

export function sheetHref(studentId: string, print = false): string {
  return `/students/${studentId}/sheet${print ? "?print=1" : ""}`;
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

/** One line per student: the month's summary as the office files it. */
export function summaryCsv(rows: ReportRow[], month: string): string[][] {
  return [
    [
      "Month", "Tutor", "Site", "Student", "Status", "Hours", "Sessions", "Missed",
      "Unlogged dates", "Sent at", "Goals attained (* = starred)", "Stopped on", "Stopped reason",
    ],
    ...rows.map((r) => [
      monthLabel(month),
      r.tutorName,
      r.student.site,
      r.student.name,
      STATUS_LABEL[r.status],
      formatHours(r.hours),
      String(r.sessions),
      String(r.missed),
      r.gaps.join(" "),
      r.sentAt ?? "",
      r.attained.map((g) => `${g.starred ? "*" : ""}${g.label} (${g.on})`).join("; "),
      r.stoppedThisMonth?.on ?? "",
      r.stoppedThisMonth?.reason ?? "",
    ]),
  ];
}

/** One line per logged day, for anyone rebuilding the paper grid. */
export function sessionsCsv(rows: ReportRow[], entries: SessionEntry[], month: string): string[][] {
  const byId = new Map(rows.map((r) => [r.student.id, r]));
  return [
    ["Date", "Tutor", "Site", "Student", "Hours", "Code"],
    ...entries
      .filter((e) => byId.has(e.studentId) && monthKey(e.date) === month)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        const r = byId.get(e.studentId)!;
        return [e.date, r.tutorName, r.student.site, r.student.name, e.hours === undefined ? "" : formatHours(e.hours), e.code ?? ""];
      }),
  ];
}
