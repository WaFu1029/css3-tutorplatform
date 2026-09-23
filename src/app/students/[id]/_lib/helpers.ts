/**
 * Student-page helpers the shared layer (lib/logic, lib/schedule) does not
 * provide. Candidates to move into lib/ — see HANDOFF.md.
 */

import type { ScheduleSlot, SessionEntry, Student } from "@/lib/types";
import { scheduledHours } from "@/lib/logic";
import { formatSlotTime, WEEKDAY_SHORT } from "@/lib/schedule";

/**
 * What one click on "held" records for a gap: the scheduled length of that
 * day's slot, else the hours most often logged for the student, else 1.
 */
export function heldHours(student: Student, date: string, entries: SessionEntry[]): number {
  const scheduled = scheduledHours(student, date);
  if (scheduled && scheduled > 0) return scheduled;
  const counts = new Map<number, number>();
  for (const e of entries) {
    if (e.studentId === student.id && e.hours) counts.set(e.hours, (counts.get(e.hours) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [hours, n] of counts) if (best === null || n > counts.get(best)!) best = hours;
  return best ?? 1;
}

/** The paper form's "Day(s):" blank, e.g. "Tue & Thu". */
export function formatDays(schedule: ScheduleSlot[]): string {
  return [...new Set(schedule.map((s) => s.weekday))]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d])
    .join(" & ");
}

/** The paper form's "Time(s):" blank; one range per distinct time. */
export function formatTimes(schedule: ScheduleSlot[]): string {
  const sorted = [...schedule].sort((a, b) => a.weekday - b.weekday);
  return [...new Set(sorted.map(formatSlotTime))].join("; ");
}

export function isStopped(student: Student): boolean {
  return student.status === "stopped";
}

/** Whether a date is outside the span the student was being tutored. */
export function outsideEnrolment(student: Student, date: string): boolean {
  if (student.startedOn && date < student.startedOn) return true;
  if (student.status === "stopped" && student.stoppedDate && date > student.stoppedDate) return true;
  return false;
}
