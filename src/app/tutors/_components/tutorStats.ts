import type { DB, Tutor } from "@/lib/types";
import { buildRows } from "@/app/reports/_lib/report";

export type TutorStats = {
  students: number;
  active: number;
  sites: string[];
  hours: number;
  sessions: number;
  sent: number;
  /** Students who owe a sheet this month (the month has started for them). */
  reportable: number;
  unlogged: number;
  stoppedThisMonth: number;
};

/** One tutor's month at a glance, from the same rows Monthly reports shows. */
export function tutorStats(db: DB, tutor: Tutor, month: string): TutorStats {
  const students = db.students.filter((s) => s.tutorId === tutor.id);
  const rows = buildRows(db, students, month);
  return {
    students: students.length,
    active: students.filter((s) => s.status === "active").length,
    sites: [...new Set(students.map((s) => s.site))].sort(),
    hours: rows.reduce((sum, r) => sum + r.hours, 0),
    sessions: rows.reduce((sum, r) => sum + r.sessions, 0),
    sent: rows.filter((r) => r.status === "sent").length,
    reportable: rows.filter((r) => r.status !== "not-started").length,
    unlogged: rows.reduce((sum, r) => sum + r.unlogged.length, 0),
    stoppedThisMonth: rows.filter((r) => r.stoppedThisMonth).length,
  };
}
