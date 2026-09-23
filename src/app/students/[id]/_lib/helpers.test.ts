import { describe, expect, it } from "vitest";
import type { SessionEntry, Student } from "@/lib/types";
import { formatDays, formatTimes, heldHours, outsideEnrolment } from "./helpers";

const amina: Student = {
  id: "s-a",
  name: "Amina",
  tutorId: "t-1",
  site: "Library",
  status: "active",
  startedOn: "2026-07-07",
  schedule: [
    { weekday: 4, startTime: "18:00", endTime: "19:30" },
    { weekday: 2, startTime: "18:00", endTime: "19:30" },
  ],
};

describe("formatDays / formatTimes", () => {
  it("fills the paper form's blanks in weekday order", () => {
    expect(formatDays(amina.schedule)).toBe("Tue & Thu");
    expect(formatTimes(amina.schedule)).toBe("6:00–7:30 pm");
  });

  it("lists each distinct time once", () => {
    const mixed = [
      { weekday: 1, startTime: "10:00", endTime: "11:00" },
      { weekday: 3, startTime: "18:00", endTime: "19:00" },
    ];
    expect(formatTimes(mixed)).toBe("10:00–11:00 am; 6:00–7:00 pm");
  });
});

describe("heldHours", () => {
  it("uses the scheduled slot length on a scheduled day", () => {
    // 2026-09-15 is a Tuesday.
    expect(heldHours(amina, "2026-09-15", [])).toBe(1.5);
  });

  it("falls back to the hours logged most often, then 1", () => {
    const entries: SessionEntry[] = [
      { id: "1", studentId: "s-a", date: "2026-09-01", hours: 2 },
      { id: "2", studentId: "s-a", date: "2026-09-03", hours: 2 },
      { id: "3", studentId: "s-a", date: "2026-09-08", hours: 1 },
      { id: "4", studentId: "s-a", date: "2026-09-10", code: "SA" },
    ];
    // 2026-09-14 is a Monday, not on the schedule.
    expect(heldHours(amina, "2026-09-14", entries)).toBe(2);
    expect(heldHours(amina, "2026-09-14", [])).toBe(1);
  });
});

describe("outsideEnrolment", () => {
  it("is true before the start date", () => {
    expect(outsideEnrolment(amina, "2026-07-01")).toBe(true);
    expect(outsideEnrolment(amina, "2026-07-07")).toBe(false);
  });

  it("is true after a stop, and only while stopped", () => {
    const stopped: Student = {
      ...amina,
      status: "stopped",
      stoppedDate: "2026-09-04",
      stoppedReason: "Moved",
    };
    expect(outsideEnrolment(stopped, "2026-09-04")).toBe(false);
    expect(outsideEnrolment(stopped, "2026-09-05")).toBe(true);
    expect(outsideEnrolment({ ...stopped, status: "active" }, "2026-09-05")).toBe(false);
  });
});
