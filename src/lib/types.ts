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

/**
 * A schedule as it changed over time. Each version applies from its `from`
 * date until the next version's; dates before the first version have none.
 * Editing a schedule appends a version, so past dates keep the schedule they
 * actually had.
 */
export type ScheduleVersion = {
  /** ISO date this version takes effect, inclusive. */
  from: string;
  /** Empty means no regular days from then on: a walk-in. */
  slots: ScheduleSlot[];
};

export type Student = {
  id: string;
  name: string;
  tutorId: string;
  site: string;
  /** Oldest version first. Empty, or empty slots, for a walk-in. */
  schedule: ScheduleVersion[];
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
  /** The tutor's note on the session, at most 50 words (NOTE_MAX_WORDS in mutations). */
  note?: string;
};

/** One cell of the attendance sheet: either hours tutored or why there were none. */
export type SessionEntry =
  | (EntryBase & { hours: number; code?: undefined })
  | (EntryBase & { code: AbsenceCode; hours?: undefined });

/** One stretch of a student's membership in a group. Rejoining adds another. */
export type GroupMember = {
  studentId: string;
  /** ISO date, inclusive. */
  joinedOn: string;
  /** ISO date they were taken out, exclusive. Unset while still a member. */
  leftOn?: string;
};

/**
 * Students tutored together. Its slots count toward a member's scheduled days
 * only on or after both `createdOn` and their `joinedOn`, and before they
 * leave or the group is deleted. Deleting a group only stamps `deletedOn`;
 * entries logged for it, and its past scheduled days, stay as they were.
 */
export type Group = {
  id: string;
  tutorId: string;
  name: string;
  /** ISO date, inclusive. */
  createdOn: string;
  /** ISO date, exclusive. Deleted groups are hidden but keep their history. */
  deletedOn?: string;
  /** Every stretch of membership, past and current. */
  members: GroupMember[];
  /** Optional, versioned like a student's. */
  schedule: ScheduleVersion[];
  /**
   * Goals the whole group works toward. Each member gets their own copy on
   * their goal board (see applySharedGoals), so progress stays per student.
   */
  sharedGoals?: SharedGoal[];
  /** The tutor's note on the group, at most 200 words (GROUP_NOTE_MAX_WORDS in mutations). */
  note?: string;
};

/** A goal set once for a group: from the paper form's catalog, or free text. */
export type SharedGoal = { catalogKey: string } | { customLabel: string };

/** A tutor saying "nothing to record" for a scheduled day, so it stops being asked about. */
export type Dismissal = {
  studentId: string;
  /** ISO date. */
  date: string;
};

export type GoalCategory = "economic" | "educational" | "family" | "societal" | "other";

type GoalBase = {
  id: string;
  studentId: string;
  category: GoalCategory;
  /** ISO date. */
  addedDate: string;
  /** ISO date work began. Unset (and not attained) means not started yet. */
  startedDate?: string;
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

/**
 * When and where one student's session on one date happens or happened, if
 * not as scheduled: 24-hour "HH:MM" and a site name. Kept apart from the
 * entry so a session can be moved before it's logged, or given a time when it
 * was never on the schedule. Unset fields fall back to the schedule and the
 * student's site; the regular schedule itself is never changed by these.
 */
export type SessionDetails = {
  studentId: string;
  /** ISO date. One record per student per date. */
  date: string;
  startTime?: string;
  endTime?: string;
  site?: string;
};

export type DB = {
  tutors: Tutor[];
  students: Student[];
  entries: SessionEntry[];
  goals: Goal[];
  reports: MonthReport[];
  groups: Group[];
  dismissals: Dismissal[];
  /** Optional so older caches and fixtures load; read it as `?? []`. */
  sessionDetails?: SessionDetails[];
};
