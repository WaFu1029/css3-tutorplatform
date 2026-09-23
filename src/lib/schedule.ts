import type { ScheduleSlot } from "./types";

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

/** "Tue & Thu · 6:00–7:30 pm", or one clause per distinct time when they differ. */
export function formatSchedule(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return "No regular schedule";
  const byTime = new Map<string, number[]>();
  for (const slot of [...schedule].sort((a, b) => a.weekday - b.weekday)) {
    const key = formatSlotTime(slot);
    byTime.set(key, [...(byTime.get(key) ?? []), slot.weekday]);
  }
  return [...byTime]
    .map(([time, days]) => `${days.map((d) => WEEKDAY_SHORT[d]).join(" & ")} · ${time}`)
    .join("; ");
}
