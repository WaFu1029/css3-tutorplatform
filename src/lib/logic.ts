/**
 * Shared attendance logic. Pure functions over the contract types, so the
 * home page, the student page and the monthly reports agree on what counts
 * as scheduled, what is still unlogged, and where a month stands.
 *
 * The schedule is scaffolding: it suggests hours and points out days that
 * might be missing, but nothing here ever stops a tutor from sending.
 *
 * Functions that depend on "today" take it as a trailing argument that
 * defaults to the real date, which keeps them testable.
 */

import type {
  AbsenceCode,
  DB,
  Dismissal,
  Goal,
  Group,
  MonthReport,
  ScheduleSlot,
  SessionDetails,
  SessionEntry,
  SharedGoal,
  Student,
} from "./types";
import { dateKey, daysInMonth, monthKey, todayISO, weekdayOf } from "./fy";
import { currentSlots, slotHours, slotsInEffect } from "./schedule";

/** The parts of the DB the scheduling rules read. Groups and dismissals are optional. */
export type Ledger = {
  entries: SessionEntry[];
  groups?: Group[];
  dismissals?: Dismissal[];
};

/* ---------- enrolment and schedule ---------- */

/** Whether a date falls between the student's start and stop dates, inclusive. */
export function enrolledOn(student: Student, date: string): boolean {
  if (student.startedOn && date < student.startedOn) return false;
  if (student.status === "stopped" && student.stoppedDate && date > student.stoppedDate) {
    return false;
  }
  return true;
}

/* ---------- groups ---------- */

/** Groups that haven't been deleted. */
export function activeGroups(groups: Group[] = []): Group[] {
  return groups.filter((g) => !g.deletedOn);
}

/** Who is in the group now. */
export function currentMemberIds(group: Group): string[] {
  return [...new Set(group.members.filter((m) => !m.leftOn).map((m) => m.studentId))];
}

/** Whether the group exists on a date: on or after creation, before deletion. */
export function groupExistsOn(group: Group, date: string): boolean {
  return date >= group.createdOn && (!group.deletedOn || date < group.deletedOn);
}

/** Whether the student was in the group on a date: the group existed and they'd joined and not left. */
export function memberOn(group: Group, studentId: string, date: string): boolean {
  return (
    groupExistsOn(group, date) &&
    group.members.some(
      (m) => m.studentId === studentId && date >= m.joinedOn && (!m.leftOn || date < m.leftOn),
    )
  );
}

/** The live groups a student is in now. */
export function groupsOf(student: Student, groups: Group[] = []): Group[] {
  return activeGroups(groups).filter((g) => currentMemberIds(g).includes(student.id));
}

/** A walk-in has no weekly slot now, of their own or through a group. */
export function isWalkIn(student: Student, groups: Group[] = []): boolean {
  return (
    currentSlots(student.schedule).length === 0 &&
    groupsOf(student, groups).every((g) => currentSlots(g.schedule).length === 0)
  );
}

export type ScheduledSlot = { slot: ScheduleSlot; group?: Group };

/**
 * Every slot a student has on a date, as the schedules stood that day: their
 * own first, then any group they were in on that date. Empty outside their
 * enrolment. Deleted groups still count for the days before deletion.
 */
export function slotsOn(student: Student, date: string, groups: Group[] = []): ScheduledSlot[] {
  if (!enrolledOn(student, date)) return [];
  const weekday = weekdayOf(date);
  return [
    ...slotsInEffect(student.schedule, date)
      .filter((s) => s.weekday === weekday)
      .map((slot) => ({ slot })),
    ...groups.flatMap((group) => {
      if (!memberOn(group, student.id, date)) return [];
      const slot = groupSlotOn(group, date);
      return slot ? [{ slot, group }] : [];
    }),
  ];
}

export function slotOn(student: Student, date: string, groups: Group[] = []): ScheduleSlot | undefined {
  return slotsOn(student, date, groups)[0]?.slot;
}

/** Every date in the month the student is scheduled, on their own or through a group. */
export function scheduledDates(student: Student, month: string, groups: Group[] = []): string[] {
  const out: string[] = [];
  for (let day = 1; day <= daysInMonth(month); day++) {
    const date = dateKey(month, day);
    if (slotsOn(student, date, groups).length) out.push(date);
  }
  return out;
}

/** Scheduled hours on a date, or null when the student isn't scheduled that day. */
export function scheduledHours(student: Student, date: string, groups: Group[] = []): number | null {
  const slot = slotOn(student, date, groups);
  return slot ? slotHours(slot) : null;
}

/** The group's slot on a date as its schedule stood then, or null (also outside the group's life). */
export function groupSlotOn(group: Group, date: string): ScheduleSlot | null {
  if (!groupExistsOn(group, date)) return null;
  return slotsInEffect(group.schedule, date).find((s) => s.weekday === weekdayOf(date)) ?? null;
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

/** The length of the student's most recent session, for walk-ins and unscheduled days. */
export function lastSessionHours(entries: SessionEntry[], studentId: string): number | null {
  return lastSession(entries, studentId)?.hours ?? null;
}

/**
 * What one tap on "Held" records: the scheduled length that day, else the
 * student's most recent session, else one hour.
 */
export function heldHours(student: Student, date: string, ledger: Ledger): number {
  return (
    scheduledHours(student, date, ledger.groups) ??
    lastSessionHours(ledger.entries, student.id) ??
    1
  );
}

/* ---------- unlogged scheduled days ---------- */

export function isDismissed(dismissals: Dismissal[] = [], studentId: string, date: string): boolean {
  return dismissals.some((d) => d.studentId === studentId && d.date === date);
}

/**
 * Scheduled dates before today with no entry and not dismissed. Today isn't
 * counted: the session may not have happened yet. This is a prompt, never a
 * reason to hold a month back.
 */
export function unloggedDays(
  student: Student,
  month: string,
  ledger: Ledger,
  today: string = todayISO(),
): string[] {
  const logged = new Set(
    ledger.entries.filter((e) => e.studentId === student.id).map((e) => e.date),
  );
  return scheduledDates(student, month, ledger.groups).filter(
    (date) =>
      date < today && !logged.has(date) && !isDismissed(ledger.dismissals, student.id, date),
  );
}

/** Unlogged scheduled days from `from` (inclusive) up to yesterday, most recent first. */
export function recentUnlogged(
  student: Student,
  from: string,
  ledger: Ledger,
  today: string = todayISO(),
): string[] {
  const months = [...new Set([monthKey(from), monthKey(today)])];
  return months
    .flatMap((m) => unloggedDays(student, m, ledger, today))
    .filter((d) => d >= from)
    .sort()
    .reverse();
}

export type MonthSummary = {
  hours: number;
  /** Entries with hours. */
  sessions: number;
  /** TA + SA entries. Holidays are not missed sessions. */
  missed: number;
  /** Unlogged scheduled days; use `.length` for the count. */
  unlogged: string[];
};

export function monthSummary(
  student: Student,
  month: string,
  ledger: Ledger,
  today: string = todayISO(),
): MonthSummary {
  let hours = 0;
  let sessions = 0;
  let missed = 0;
  for (const e of ledger.entries) {
    if (e.studentId !== student.id || monthKey(e.date) !== month) continue;
    if (e.code === "TA" || e.code === "SA") missed++;
    else if (e.hours !== undefined && e.hours > 0) {
      hours += e.hours;
      sessions++;
    }
  }
  return { hours, sessions, missed, unlogged: unloggedDays(student, month, ledger, today) };
}

/* ---------- month status and the send review ---------- */

/**
 * The one set of month statuses, used on every page. Unlogged days are a
 * separate count shown beside it, never a status.
 */
export type MonthStatus = "not-started" | "open" | "sent";

export const MONTH_STATUS_LABEL: Record<MonthStatus, string> = {
  "not-started": "Not started",
  open: "Open",
  // Stored as "sent"; tutors and staff see it as confirmed.
  sent: "Confirmed",
};

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

export function monthStatus(
  student: Student,
  month: string,
  reports: MonthReport[],
  today: string = todayISO(),
): MonthStatus {
  if (isMonthSent(reports, student.id, month)) return "sent";
  if (month > monthKey(today)) return "not-started";
  if (student.startedOn && monthKey(student.startedOn) > month) return "not-started";
  return "open";
}

/**
 * What the send review asks a tutor to look at before a month goes to the
 * office. None of it blocks sending; `clean` means there is nothing to ask.
 */
export type SendCheck = {
  unlogged: string[];
  /** The month still has days to come. */
  notOver: boolean;
  /** Nothing was scheduled that month (a walk-in, say), so there's nothing to check against. */
  noSchedule: boolean;
  /** Nothing with hours logged. */
  noSessions: boolean;
  clean: boolean;
};

export function sendCheck(
  student: Student,
  month: string,
  ledger: Ledger,
  today: string = todayISO(),
): SendCheck {
  const summary = monthSummary(student, month, ledger, today);
  const check = {
    unlogged: summary.unlogged,
    notOver: dateKey(month, daysInMonth(month)) >= today,
    noSchedule: scheduledDates(student, month, ledger.groups).length === 0,
    noSessions: summary.sessions === 0,
  };
  return {
    ...check,
    clean: !check.unlogged.length && !check.notOver && !check.noSchedule && !check.noSessions,
  };
}

/** Whether a student owes a sheet for the month at all: they were enrolled for some of it. */
export function expectsReport(student: Student, month: string): boolean {
  if (student.status === "stopped" && student.stoppedDate && monthKey(student.stoppedDate) < month) {
    return false;
  }
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

/** Builds an entry value; exactly one of hours or code. */
export function makeEntry(
  base: {
    id: string;
    studentId: string;
    date: string;
    groupId?: string;
    loggedAt?: string;
    note?: string;
  },
  value: { hours: number } | { code: AbsenceCode },
): SessionEntry {
  return "code" in value ? { ...base, code: value.code } : { ...base, hours: value.hours };
}

/** The scheduling view of the whole DB. */
export function ledgerOf(db: Pick<DB, "entries" | "groups" | "dismissals">): Ledger {
  return { entries: db.entries, groups: db.groups, dismissals: db.dismissals };
}

/* ---------- a session's own time and place ---------- */

export function sessionDetailsFor(
  details: SessionDetails[] = [],
  studentId: string,
  date: string,
): SessionDetails | undefined {
  return details.find((d) => d.studentId === studentId && d.date === date);
}

export type WhenWhere = {
  startTime: string | null;
  endTime: string | null;
  site: string;
  /** Some of it differs from the schedule for this one session. */
  changed: boolean;
};

/** When and where the student's session on the date is: its own details, else the schedule. */
export function whenWhere(
  student: Student,
  date: string,
  db: { groups?: Group[]; sessionDetails?: SessionDetails[] },
): WhenWhere {
  const slot = slotOn(student, date, db.groups);
  const own = sessionDetailsFor(db.sessionDetails, student.id, date);
  return {
    startTime: own?.startTime ?? slot?.startTime ?? null,
    endTime: own?.endTime ?? slot?.endTime ?? null,
    site: own?.site ?? student.site,
    changed: Boolean(own?.startTime || own?.endTime || own?.site),
  };
}

/* ---------- goals shared through groups ---------- */

/** Whether a student's goal is the same goal as one set for a group. */
export function sameGoal(goal: Goal, shared: SharedGoal): boolean {
  if ("catalogKey" in shared) return goal.catalogKey === shared.catalogKey;
  return goal.customLabel?.trim().toLowerCase() === shared.customLabel.trim().toLowerCase();
}

/** The groups a goal comes from: current, undeleted groups of the student that share it. */
export function goalGroups(goal: Goal, groups: Group[] = []): Group[] {
  return activeGroups(groups).filter(
    (g) =>
      currentMemberIds(g).includes(goal.studentId) &&
      (g.sharedGoals ?? []).some((shared) => sameGoal(goal, shared)),
  );
}
