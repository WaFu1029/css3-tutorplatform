/**
 * Shared attendance logic. Pure functions over the contract types, so the
 * home page, the student page and the monthly reports all agree on what a
 * gap is and when a month may be sent.
 *
 * Functions that depend on "today" take it as a trailing argument that
 * defaults to the real date, which keeps them testable.
 */

import type { AbsenceCode, DB, MonthReport, ScheduleSlot, SessionEntry, Student } from "./types";
import { dateKey, daysInMonth, monthKey, todayISO, weekdayOf } from "./fy";
import { slotHours } from "./schedule";

/** Whether a date falls between the student's start and stop dates. */
function enrolledOn(student: Student, date: string): boolean {
  if (student.startedOn && date < student.startedOn) return false;
  if (student.stoppedDate && date > student.stoppedDate) return false;
  return true;
}

/** The slot a student is scheduled for on a date, if any. */
export function slotOn(student: Student, date: string): ScheduleSlot | undefined {
  if (!enrolledOn(student, date)) return undefined;
  return student.schedule.find((s) => s.weekday === weekdayOf(date));
}

/** Every date in the month the student is scheduled, within their start and stop dates. */
export function scheduledDates(student: Student, month: string): string[] {
  const out: string[] = [];
  for (let day = 1; day <= daysInMonth(month); day++) {
    const date = dateKey(month, day);
    if (slotOn(student, date)) out.push(date);
  }
  return out;
}

/** Scheduled hours on a date, or null when the student isn't scheduled that day. */
export function scheduledHours(student: Student, date: string): number | null {
  const slot = slotOn(student, date);
  return slot ? slotHours(slot) : null;
}

/**
 * Scheduled dates before today that have no entry at all. Today is not a gap
 * yet: the session may simply not have happened.
 */
export function findGaps(
  student: Student,
  month: string,
  entries: SessionEntry[],
  today: string = todayISO(),
): string[] {
  const logged = new Set(
    entries.filter((e) => e.studentId === student.id).map((e) => e.date),
  );
  return scheduledDates(student, month).filter((date) => date < today && !logged.has(date));
}

export type MonthSummary = {
  hours: number;
  /** Entries with hours. */
  sessions: number;
  /** TA + SA entries. Holidays are not missed sessions. */
  missed: number;
  /** The gap dates themselves; use `.length` for the count. */
  gaps: string[];
};

export function monthSummary(
  student: Student,
  month: string,
  entries: SessionEntry[],
  today: string = todayISO(),
): MonthSummary {
  let hours = 0;
  let sessions = 0;
  let missed = 0;
  for (const e of entries) {
    if (e.studentId !== student.id || monthKey(e.date) !== month) continue;
    if (e.code === "TA" || e.code === "SA") missed++;
    else if (e.hours !== undefined && e.hours > 0) {
      hours += e.hours;
      sessions++;
    }
  }
  return { hours, sessions, missed, gaps: findGaps(student, month, entries, today) };
}

/** A month may be sent only once every past scheduled day has an entry. */
export function canSend(
  student: Student,
  month: string,
  entries: SessionEntry[],
  today: string = todayISO(),
): boolean {
  return findGaps(student, month, entries, today).length === 0;
}

/* ---------- month reports ---------- */

export function reportFor(
  reports: MonthReport[],
  studentId: string,
  month: string,
): MonthReport | undefined {
  return reports.find((r) => r.studentId === studentId && r.month === month);
}

export function isMonthSent(reports: MonthReport[], studentId: string, month: string): boolean {
  return reportFor(reports, studentId, month)?.status === "sent";
}

/**
 * Where a student's month stands, for badges:
 * - sent: with the office
 * - gaps: scheduled days so far are missing entries
 * - ready: nothing missing and no scheduled days left, today included
 * - open: nothing missing yet, but the month still has sessions ahead
 */
export type MonthStatus = "sent" | "gaps" | "ready" | "open";

export function monthStatus(
  student: Student,
  month: string,
  db: Pick<DB, "entries" | "reports">,
  today: string = todayISO(),
): MonthStatus {
  if (isMonthSent(db.reports, student.id, month)) return "sent";
  if (!canSend(student, month, db.entries, today)) return "gaps";
  const ahead = scheduledDates(student, month).some((d) => d >= today);
  return ahead ? "open" : "ready";
}

/**
 * Whether a student owes a sheet for the month at all: they were on the
 * schedule for some of it. A student who stopped before the month began, or
 * starts after it, has nothing to send.
 */
export function expectsReport(student: Student, month: string): boolean {
  if (student.stoppedDate && monthKey(student.stoppedDate) < month) return false;
  if (student.startedOn && monthKey(student.startedOn) > month) return false;
  return true;
}

/* ---------- entry lookups ---------- */

export function entryIndex(entries: SessionEntry[]): Map<string, SessionEntry> {
  const map = new Map<string, SessionEntry>();
  for (const e of entries) map.set(`${e.studentId}:${e.date}`, e);
  return map;
}

export function entryOn(
  entries: SessionEntry[],
  studentId: string,
  date: string,
): SessionEntry | undefined {
  return entries.find((e) => e.studentId === studentId && e.date === date);
}

export function hoursInMonth(entries: SessionEntry[], studentId: string, month: string): number {
  return entries.reduce(
    (sum, e) =>
      e.studentId === studentId && monthKey(e.date) === month ? sum + (e.hours ?? 0) : sum,
    0,
  );
}

export function sessionsInMonth(entries: SessionEntry[], studentId: string, month: string): number {
  return entries.filter(
    (e) => e.studentId === studentId && monthKey(e.date) === month && (e.hours ?? 0) > 0,
  ).length;
}

/** The most recent entry with hours, i.e. the last time tutoring actually happened. */
export function lastSession(entries: SessionEntry[], studentId: string): SessionEntry | null {
  let last: SessionEntry | null = null;
  for (const e of entries) {
    if (e.studentId !== studentId || !(e.hours && e.hours > 0)) continue;
    if (!last || e.date > last.date) last = e;
  }
  return last;
}

/** Builds an entry value; exactly one of hours or code. */
export function makeEntry(
  base: { id: string; studentId: string; date: string; groupId?: string; loggedAt?: string },
  value: { hours: number } | { code: AbsenceCode },
): SessionEntry {
  return "code" in value ? { ...base, code: value.code } : { ...base, hours: value.hours };
}
