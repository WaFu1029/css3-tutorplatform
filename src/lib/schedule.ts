import type { ScheduleSlot, ScheduleVersion } from "./types";

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Scheduled length of a slot in hours, e.g. 18:00–19:30 → 1.5. */
export function slotHours(slot: ScheduleSlot): number {
  return Math.max(0, minutes(slot.endTime) - minutes(slot.startTime)) / 60;
}

/** "18:00" → "6:00 pm". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "6:00–7:30 pm", dropping the first suffix when both ends share it. */
export function formatSlotTime(slot: ScheduleSlot): string {
  const start = formatTime(slot.startTime);
  const end = formatTime(slot.endTime);
  const sameHalf = start.slice(-2) === end.slice(-2);
  return `${sameHalf ? start.slice(0, -3) : start}–${end}`;
}

export const WALK_IN = "Walk-in";

/** "Tue & Thu · 6:00–7:30 pm", or one clause per distinct time when they differ. */
export function formatSchedule(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return WALK_IN;
  const byTime = new Map<string, number[]>();
  for (const slot of [...schedule].sort((a, b) => a.weekday - b.weekday)) {
    const key = formatSlotTime(slot);
    byTime.set(key, [...(byTime.get(key) ?? []), slot.weekday]);
  }
  return [...byTime]
    .map(([time, days]) => `${days.map((d) => WEEKDAY_SHORT[d]).join(" & ")} · ${time}`)
    .join("; ");
}

/** The paper form's "Day(s):" blank, e.g. "Tue & Thu"; "Walk-in" with no schedule. */
export function formatDays(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return WALK_IN;
  return [...new Set(schedule.map((s) => s.weekday))]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d])
    .join(" & ");
}

/** The paper form's "Time(s):" blank, one range per distinct time; "Walk-in" with no schedule. */
export function formatTimes(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return WALK_IN;
  const sorted = [...schedule].sort((a, b) => a.weekday - b.weekday);
  return [...new Set(sorted.map(formatSlotTime))].join("; ");
}

/* ---------- schedule history ---------- */

/** The version in effect on a date: the latest one starting on or before it. */
export function versionOn(history: ScheduleVersion[], date: string): ScheduleVersion | undefined {
  let found: ScheduleVersion | undefined;
  for (const v of history) if (v.from <= date && (!found || v.from >= found.from)) found = v;
  return found;
}

/** The slots in effect on a date; none before the first version. */
export function slotsInEffect(history: ScheduleVersion[], date: string): ScheduleSlot[] {
  return versionOn(history, date)?.slots ?? [];
}

/** The newest version's slots: what the schedule is now, for display and editing. */
export function currentSlots(history: ScheduleVersion[]): ScheduleSlot[] {
  return history.reduce<ScheduleVersion | undefined>(
    (latest, v) => (!latest || v.from >= latest.from ? v : latest),
    undefined,
  )?.slots ?? [];
}

/**
 * The history with `slots` taking effect from `from` onward. Versions that
 * start on or after `from` are replaced, so editing twice in a day keeps one
 * version; everything before `from` is left alone.
 */
export function withSchedule(
  history: ScheduleVersion[],
  from: string,
  slots: ScheduleSlot[],
): ScheduleVersion[] {
  return [...history.filter((v) => v.from < from), { from, slots }];
}

/** Same days and times, in any order. */
export function sameSlots(a: ScheduleSlot[], b: ScheduleSlot[]): boolean {
  const key = (slots: ScheduleSlot[]) =>
    JSON.stringify(
      [...slots].sort((x, y) => x.weekday - y.weekday).map((x) => [x.weekday, x.startTime, x.endTime]),
    );
  return key(a) === key(b);
}
