export type AbsenceCode = "T" | "S" | "H";

/** One cell of the attendance ledger: a single student on a single day. */
export type Entry = {
  id: string;
  studentId: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Hours tutored. 0 when the session did not happen. */
  hours: number;
  /** Why no hours were tutored, when that is the case. */
  code: AbsenceCode | null;
  note?: string;
  loggedAt: string;
};

export type Tutor = {
  id: string;
  name: string;
  email: string;
};

export type GoalMark = {
  /** ISO date the goal was attained. */
  attainedOn: string;
};

export type Student = {
  id: string;
  name: string;
  tutorId: string;
  site: string;
  days: string;
  times: string;
  startedOn: string;
  /** Goal code (e.g. "A1") -> when it was attained. */
  goals: Record<string, GoalMark>;
  /** Free-text goals from section E, with the date attained if any. */
  otherGoals: { id: string; label: string; attainedOn: string | null }[];
  stopped: { on: string; reason: string } | null;
};

/** A tutor's sign-off that one student's month is complete and ready to report. */
export type Submission = {
  studentId: string;
  /** YYYY-MM */
  month: string;
  submittedAt: string;
  submittedBy: string;
};

export type DB = {
  tutors: Tutor[];
  students: Student[];
  entries: Entry[];
  submissions: Submission[];
};
