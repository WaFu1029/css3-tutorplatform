import { describe, expect, it } from "vitest";
import type { SessionEntry, Student } from "./types";
import {
  canSend,
  findGaps,
  monthStatus,
  monthSummary,
  scheduledDates,
  scheduledHours,
} from "./logic";

// September 2026: Tuesdays are 1, 8, 15, 22, 29 and Thursdays 3, 10, 17, 24.
const student: Student = {
  id: "s1",
  name: "Test Student",
  tutorId: "t1",
  site: "Library",
  schedule: [
    { weekday: 2, startTime: "18:00", endTime: "19:30" },
    { weekday: 4, startTime: "18:00", endTime: "19:30" },
  ],
  status: "active",
};

let n = 0;
function hours(date: string, h: number, studentId = "s1"): SessionEntry {
  return { id: `e${n++}`, studentId, date, hours: h };
}
function code(date: string, c: "TA" | "SA" | "H", studentId = "s1"): SessionEntry {
  return { id: `e${n++}`, studentId, date, code: c };
}

describe("scheduledDates", () => {
  it("lists every date in the month on a scheduled weekday", () => {
    expect(scheduledDates(student, "2026-09")).toEqual([
      "2026-09-01",
      "2026-09-03",
      "2026-09-08",
      "2026-09-10",
      "2026-09-15",
      "2026-09-17",
      "2026-09-22",
      "2026-09-24",
      "2026-09-29",
    ]);
  });

  it("returns nothing for a student with no schedule", () => {
    expect(scheduledDates({ ...student, schedule: [] }, "2026-09")).toEqual([]);
  });

  it("skips dates before the start date", () => {
    expect(scheduledDates({ ...student, startedOn: "2026-09-20" }, "2026-09")).toEqual([
      "2026-09-22",
      "2026-09-24",
      "2026-09-29",
    ]);
  });

  it("stops at the stopped date, inclusive", () => {
    const stopped: Student = {
      ...student,
      status: "stopped",
      stoppedDate: "2026-09-08",
      stoppedReason: "Moved",
    };
    expect(scheduledDates(stopped, "2026-09")).toEqual([
      "2026-09-01",
      "2026-09-03",
      "2026-09-08",
    ]);
    expect(scheduledDates(stopped, "2026-10")).toEqual([]);
  });

  it("handles month lengths and leap years", () => {
    const sundays: Student = { ...student, schedule: [{ weekday: 0, startTime: "09:00", endTime: "10:00" }] };
    // February 2028 has 29 days; the 27th is a Sunday and there is no 30th.
    expect(scheduledDates(sundays, "2028-02").at(-1)).toBe("2028-02-27");
  });
});

describe("scheduledHours", () => {
  it("reads the slot length on a scheduled day", () => {
    expect(scheduledHours(student, "2026-09-22")).toBe(1.5);
  });
  it("is null on an unscheduled day", () => {
    expect(scheduledHours(student, "2026-09-21")).toBeNull();
  });
});

describe("findGaps", () => {
  const today = "2026-09-17";

  it("counts every unlogged scheduled day before today as a gap", () => {
    expect(findGaps(student, "2026-09", [], today)).toEqual([
      "2026-09-01",
      "2026-09-03",
      "2026-09-08",
      "2026-09-10",
      "2026-09-15",
    ]);
  });

  it("does not count future scheduled days", () => {
    const gaps = findGaps(student, "2026-09", [], today);
    expect(gaps.every((d) => d < today)).toBe(true);
    expect(gaps).not.toContain("2026-09-22");
  });

  it("does not count today yet: the session may still happen", () => {
    expect(findGaps(student, "2026-09", [], today)).not.toContain(today);
    expect(findGaps(student, "2026-09", [], "2026-09-18")).toContain(today);
  });

  it("treats any entry, hours or absence code, as filling the day", () => {
    const entries = [
      hours("2026-09-01", 1.5),
      code("2026-09-03", "SA"),
      code("2026-09-08", "TA"),
      code("2026-09-10", "H"),
      hours("2026-09-15", 2),
    ];
    expect(findGaps(student, "2026-09", entries, "2026-09-18")).toEqual(["2026-09-17"]);
  });

  it("ignores other students' entries", () => {
    const entries = [hours("2026-09-01", 1.5, "someone-else")];
    expect(findGaps(student, "2026-09", entries, today)).toContain("2026-09-01");
  });

  it("has no gaps for a month entirely in the future", () => {
    expect(findGaps(student, "2026-10", [], today)).toEqual([]);
  });

  it("counts unlogged days across the whole of a past month", () => {
    // August 2026 has four Tuesdays and four Thursdays.
    expect(findGaps(student, "2026-08", [], today)).toHaveLength(8);
  });
});

describe("monthSummary", () => {
  const today = "2026-09-10";
  const entries = [
    hours("2026-09-01", 1.5),
    hours("2026-09-03", 2),
    code("2026-09-08", "SA"),
    code("2026-09-10", "TA"),
    hours("2026-08-27", 1.5), // previous month
    hours("2026-09-03", 3, "someone-else"),
  ];

  it("totals hours and sessions from entries with hours", () => {
    const s = monthSummary(student, "2026-09", entries, today);
    expect(s.hours).toBe(3.5);
    expect(s.sessions).toBe(2);
  });

  it("counts TA and SA as missed, but not holidays", () => {
    const s = monthSummary(student, "2026-09", [...entries, code("2026-09-15", "H")], "2026-09-15");
    expect(s.missed).toBe(2);
  });

  it("reports the gap dates", () => {
    const s = monthSummary(student, "2026-09", entries.slice(0, 3), "2026-09-11");
    expect(s.gaps).toEqual(["2026-09-10"]);
  });

  it("is all zeros for an empty month", () => {
    expect(monthSummary(student, "2026-10", [], today)).toEqual({
      hours: 0,
      sessions: 0,
      missed: 0,
      gaps: [],
    });
  });
});

describe("canSend and monthStatus", () => {
  const today = "2026-09-10";
  const full = [
    hours("2026-09-01", 1.5),
    hours("2026-09-03", 1.5),
    hours("2026-09-08", 1.5),
    code("2026-09-10", "H"),
  ];

  it("blocks sending while there are gaps", () => {
    expect(canSend(student, "2026-09", full.slice(1), today)).toBe(false); // Sep 1 missing
    expect(monthStatus(student, "2026-09", { entries: full.slice(1), reports: [] }, today)).toBe("gaps");
  });

  it("allows sending when nothing is missing so far", () => {
    expect(canSend(student, "2026-09", full, today)).toBe(true);
    // Sessions still ahead this month, so it's open rather than ready.
    expect(monthStatus(student, "2026-09", { entries: full, reports: [] }, today)).toBe("open");
  });

  it("is ready once the month has no scheduled days left", () => {
    const all = scheduledDates(student, "2026-09").map((d) => hours(d, 1.5));
    expect(monthStatus(student, "2026-09", { entries: all, reports: [] }, "2026-09-30")).toBe("ready");
    // The 29th is the last session; on that day it may still be unlogged, so not ready yet.
    const most = all.slice(0, -1);
    expect(monthStatus(student, "2026-09", { entries: most, reports: [] }, "2026-09-29")).toBe("open");
  });

  it("is sent when the report is sent, and open again once reopened", () => {
    const sent = [{ studentId: "s1", month: "2026-09", status: "sent" as const, sentAt: "x" }];
    expect(monthStatus(student, "2026-09", { entries: full, reports: sent }, today)).toBe("sent");
    const reopened = [{ studentId: "s1", month: "2026-09", status: "open" as const }];
    expect(monthStatus(student, "2026-09", { entries: full, reports: reopened }, today)).toBe("open");
  });
});
