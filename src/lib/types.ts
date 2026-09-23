/**
 * The shared data contract. Sessions 1–3 all build against these shapes, so
 * change them only by agreement.
 */

/** TA tutor absent, SA student absent, H holiday. */
export type AbsenceCode = "TA" | "SA" | "H";

export type Tutor = {
  id: string;
  name: string;
  email: string;
};

/** One weekly slot. Weekday follows Date#getDay (0 Sunday … 6 Saturday). */
export type ScheduleSlot = {
  weekday: number;
  /** 24-hour "HH:MM". */
  startTime: string;
  /** 24-hour "HH:MM". */
  endTime: string;
};

export type Student = {
  id: string;
  name: string;
  tutorId: string;
  site: string;
  schedule: ScheduleSlot[];
  status: "active" | "stopped";
  stoppedReason?: string;
  /** ISO date. Nothing is scheduled after it. */
  stoppedDate?: string;
  /** ISO date. Nothing is scheduled before it. Not in the paper form; optional. */
  startedOn?: string;
};

type EntryBase = {
  id: string;
  studentId: string;
  /** ISO date, YYYY-MM-DD. One entry per student per date. */
  date: string;
  /** Shared by the entries saved together as one group session. */
  groupId?: string;
  loggedAt?: string;
};

/** One cell of the attendance sheet: either hours tutored or why there were none. */
export type SessionEntry =
  | (EntryBase & { hours: number; code?: undefined })
  | (EntryBase & { code: AbsenceCode; hours?: undefined });

/** @deprecated Old name, kept so existing imports compile. Use SessionEntry. */
export type Entry = SessionEntry;

export type GoalCategory = "economic" | "educational" | "family" | "societal" | "other";

type GoalBase = {
  id: string;
  studentId: string;
  category: GoalCategory;
  /** ISO date. */
  addedDate: string;
  /** ISO date. Unset while the goal is still being worked on. */
  attainedDate?: string;
};

/** A goal a student is working toward: one from the paper form's catalog, or free text. */
export type Goal =
  | (GoalBase & { catalogKey: string; customLabel?: undefined })
  | (GoalBase & { customLabel: string; catalogKey?: undefined });

/** A tutor's monthly sheet for one student. Sent months can be reopened. */
export type MonthReport = {
  studentId: string;
  /** YYYY-MM */
  month: string;
  status: "open" | "sent";
  sentAt?: string;
};

export type DB = {
  tutors: Tutor[];
  students: Student[];
  entries: SessionEntry[];
  goals: Goal[];
  reports: MonthReport[];
};
