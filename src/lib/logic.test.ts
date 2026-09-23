import { describe, expect, it } from "vitest";
import type { Group, ScheduleSlot, SessionEntry, Student } from "./types";
import {
  enrolledOn,
  heldHours,
  isWalkIn,
  monthStatus,
  monthSummary,
  recentUnlogged,
  scheduledDates,
  scheduledHours,
  sendCheck,
  unloggedDays,
} from "./logic";

// September 2026: Tuesdays are 1, 8, 15, 22, 29 and Thursdays 3, 10, 17, 24.
// Wednesdays are 2, 9, 16, 23, 30.
/** One schedule version in effect for all the dates these tests use. */
const always = (slots: ScheduleSlot[]) => [{ from: "2026-01-01", slots }];

const student: Student = {
  id: "s1",
  name: "Test Student",
  tutorId: "t1",
  site: "Library",
  schedule: always([
    { weekday: 2, startTime: "18:00", endTime: "19:30" },
    { weekday: 4, startTime: "18:00", endTime: "19:30" },
  ]),
  status: "active",
};

const walkIn: Student = { ...student, id: "w1", schedule: [] };

const wednesdays: Group = {
  id: "g1",
  tutorId: "t1",
  name: "Wednesday group",
  createdOn: "2026-01-01",
  members: [
    { studentId: "s1", joinedOn: "2026-01-01" },
    { studentId: "w1", joinedOn: "2026-01-01" },
  ],
  schedule: always([{ weekday: 3, startTime: "10:00", endTime: "12:00" }]),
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
      "2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10", "2026-09-15",
      "2026-09-17", "2026-09-22", "2026-09-24", "2026-09-29",
    ]);
  });

  it("skips dates before the start date", () => {
    expect(scheduledDates({ ...student, startedOn: "2026-09-20" }, "2026-09")).toEqual([
      "2026-09-22", "2026-09-24", "2026-09-29",
    ]);
  });

  it("stops at the stopped date, inclusive", () => {
    const stopped: Student = { ...student, status: "stopped", stoppedDate: "2026-09-08", stoppedReason: "Moved" };
    expect(scheduledDates(stopped, "2026-09")).toEqual(["2026-09-01", "2026-09-03", "2026-09-08"]);
    expect(scheduledDates(stopped, "2026-10")).toEqual([]);
  });

  it("handles month lengths and leap years", () => {
    const sundays: Student = { ...student, schedule: always([{ weekday: 0, startTime: "09:00", endTime: "10:00" }]) };
    // February 2028 has 29 days; the 27th is a Sunday and there is no 30th.
    expect(scheduledDates(sundays, "2028-02").at(-1)).toBe("2028-02-27");
  });

  it("adds the schedules of the student's groups", () => {
    const dates = scheduledDates(student, "2026-09", [wednesdays]);
    expect(dates).toContain("2026-09-02");
    expect(dates).toContain("2026-09-01");
    expect(dates).toHaveLength(9 + 5);
  });

  it("ignores groups the student isn't in", () => {
    const other = { ...wednesdays, members: [{ studentId: "someone-else", joinedOn: "2026-01-01" }] };
    expect(scheduledDates(student, "2026-09", [other])).toHaveLength(9);
  });

  it("ignores a group with no schedule", () => {
    const loose = { ...wednesdays, schedule: [] };
    expect(scheduledDates(student, "2026-09", [loose])).toHaveLength(9);
  });
});

describe("scheduledHours", () => {
  it("reads the slot length on a scheduled day", () => {
    expect(scheduledHours(student, "2026-09-22")).toBe(1.5);
  });
  it("reads a group's slot", () => {
    expect(scheduledHours(student, "2026-09-23", [wednesdays])).toBe(2);
  });
  it("is null on an unscheduled day", () => {
    expect(scheduledHours(student, "2026-09-21")).toBeNull();
  });
});

describe("unloggedDays", () => {
  const today = "2026-09-17";

  it("counts every unlogged scheduled day before today", () => {
    expect(unloggedDays(student, "2026-09", { entries: [] }, today)).toEqual([
      "2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10", "2026-09-15",
    ]);
  });

  it("does not count today or future scheduled days", () => {
    const days = unloggedDays(student, "2026-09", { entries: [] }, today);
    expect(days).not.toContain(today);
    expect(days).not.toContain("2026-09-22");
  });

  it("treats any entry, hours or absence code, as filling the day", () => {
    const entries = [
      hours("2026-09-01", 1.5), code("2026-09-03", "SA"), code("2026-09-08", "TA"),
      code("2026-09-10", "H"), hours("2026-09-15", 2),
    ];
    expect(unloggedDays(student, "2026-09", { entries }, "2026-09-18")).toEqual(["2026-09-17"]);
  });

  it("ignores other students' entries", () => {
    const entries = [hours("2026-09-01", 1.5, "someone-else")];
    expect(unloggedDays(student, "2026-09", { entries }, today)).toContain("2026-09-01");
  });

  it("leaves out dismissed days", () => {
    const dismissals = [{ studentId: "s1", date: "2026-09-03" }, { studentId: "other", date: "2026-09-08" }];
    const days = unloggedDays(student, "2026-09", { entries: [], dismissals }, today);
    expect(days).not.toContain("2026-09-03");
    expect(days).toContain("2026-09-08");
  });

  it("includes days scheduled through a group", () => {
    const days = unloggedDays(student, "2026-09", { entries: [], groups: [wednesdays] }, today);
    expect(days).toContain("2026-09-02");
    expect(days).toContain("2026-09-16");
  });

  it("is empty for a walk-in", () => {
    expect(unloggedDays(walkIn, "2026-09", { entries: [] }, today)).toEqual([]);
  });

  it("collects the recent ones across a month boundary, newest first", () => {
    expect(recentUnlogged(student, "2026-09-25", { entries: [] }, "2026-10-02")).toEqual([
      "2026-10-01", "2026-09-29",
    ]);
  });
});

describe("monthSummary", () => {
  const today = "2026-09-10";
  const entries = [
    hours("2026-09-01", 1.5), hours("2026-09-03", 2), code("2026-09-08", "SA"),
    code("2026-09-10", "TA"), hours("2026-08-27", 1.5), hours("2026-09-03", 3, "someone-else"),
  ];

  it("totals hours and sessions from entries with hours", () => {
    const s = monthSummary(student, "2026-09", { entries }, today);
    expect(s.hours).toBe(3.5);
    expect(s.sessions).toBe(2);
  });

  it("counts TA and SA as missed, but not holidays", () => {
    const s = monthSummary(student, "2026-09", { entries: [...entries, code("2026-09-15", "H")] }, "2026-09-15");
    expect(s.missed).toBe(2);
  });

  it("reports the unlogged dates", () => {
    const s = monthSummary(student, "2026-09", { entries: entries.slice(0, 3) }, "2026-09-11");
    expect(s.unlogged).toEqual(["2026-09-10"]);
  });

  it("is all zeros for an empty month", () => {
    expect(monthSummary(student, "2026-10", { entries: [] }, today)).toEqual({
      hours: 0, sessions: 0, missed: 0, unlogged: [],
    });
  });
});

describe("monthStatus", () => {
  const sent = [{ studentId: "s1", month: "2026-09", status: "sent" as const, sentAt: "x" }];

  it("is open for the current month, unlogged days or not", () => {
    expect(monthStatus(student, "2026-09", [], "2026-09-20")).toBe("open");
  });
  it("is open for a past month that was never sent", () => {
    expect(monthStatus(student, "2026-08", [], "2026-09-20")).toBe("open");
  });
  it("is not-started for a future month", () => {
    expect(monthStatus(student, "2026-10", [], "2026-09-20")).toBe("not-started");
  });
  it("is not-started for a month before the student began", () => {
    expect(monthStatus({ ...student, startedOn: "2026-09-05" }, "2026-08", [], "2026-09-20")).toBe("not-started");
  });
  it("is sent when sent, and open again once reopened", () => {
    expect(monthStatus(student, "2026-09", sent, "2026-09-20")).toBe("sent");
    const reopened = [{ ...sent[0], status: "open" as const }];
    expect(monthStatus(student, "2026-09", reopened, "2026-09-20")).toBe("open");
  });
});

describe("sendCheck", () => {
  it("is clean for a finished month with everything logged", () => {
    const all = scheduledDates(student, "2026-08").map((d) => hours(d, 1.5));
    expect(sendCheck(student, "2026-08", { entries: all }, "2026-09-20").clean).toBe(true);
  });

  it("flags unlogged days, but only as information", () => {
    const check = sendCheck(student, "2026-08", { entries: [hours("2026-08-04", 1.5)] }, "2026-09-20");
    expect(check.unlogged).toHaveLength(7);
    expect(check.clean).toBe(false);
  });

  it("flags a month that isn't over yet", () => {
    expect(sendCheck(student, "2026-09", { entries: [] }, "2026-09-30").notOver).toBe(true);
    expect(sendCheck(student, "2026-08", { entries: [] }, "2026-09-01").notOver).toBe(false);
  });

  it("flags a walk-in, who has no schedule to check against", () => {
    const check = sendCheck(walkIn, "2026-08", { entries: [hours("2026-08-04", 1, "w1")] }, "2026-09-20");
    expect(check.noSchedule).toBe(true);
    expect(check.unlogged).toEqual([]);
  });

  it("does not treat a walk-in in a scheduled group as unscheduled", () => {
    expect(isWalkIn(walkIn, [wednesdays])).toBe(false);
  });

  it("flags a month with no sessions", () => {
    expect(sendCheck(student, "2026-08", { entries: [code("2026-08-04", "SA")] }, "2026-09-20").noSessions).toBe(true);
  });
});

describe("walk-ins", () => {
  it("have no scheduled dates and no scheduled hours", () => {
    expect(scheduledDates(walkIn, "2026-09")).toEqual([]);
    expect(scheduledHours(walkIn, "2026-09-22")).toBeNull();
  });

  it("default Held to their most recent session length", () => {
    const entries = [hours("2026-09-01", 2, "w1"), hours("2026-09-09", 1.5, "w1")];
    expect(heldHours(walkIn, "2026-09-22", { entries })).toBe(1.5);
    expect(heldHours(walkIn, "2026-09-22", { entries: [] })).toBe(1);
  });
});

describe("enrolledOn", () => {
  const started: Student = { ...student, startedOn: "2026-07-07" };

  it("is false before the start date", () => {
    expect(enrolledOn(started, "2026-07-06")).toBe(false);
    expect(enrolledOn(started, "2026-07-07")).toBe(true);
  });

  it("is false after a stop, and only while stopped", () => {
    const stopped: Student = { ...started, status: "stopped", stoppedDate: "2026-09-04", stoppedReason: "Moved" };
    expect(enrolledOn(stopped, "2026-09-04")).toBe(true);
    expect(enrolledOn(stopped, "2026-09-05")).toBe(false);
    expect(enrolledOn({ ...stopped, status: "active" }, "2026-09-05")).toBe(true);
  });
});

describe("schedule history", () => {
  // Tue/Thu from July; on Sep 15 the tutor switches to Mondays only.
  const edited: Student = {
    ...student,
    schedule: [
      { from: "2026-07-01", slots: student.schedule[0].slots },
      { from: "2026-09-15", slots: [{ weekday: 1, startTime: "10:00", endTime: "11:00" }] },
    ],
  };

  it("leaves past months on the schedule they had", () => {
    expect(scheduledDates(edited, "2026-08")).toEqual(scheduledDates(student, "2026-08"));
  });

  it("uses each version from its own date within a month", () => {
    expect(scheduledDates(edited, "2026-09")).toEqual([
      "2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10", // Tue/Thu, before the edit
      "2026-09-21", "2026-09-28", // Mondays, from the 15th on
    ]);
    expect(scheduledHours(edited, "2026-09-10")).toBe(1.5);
    expect(scheduledHours(edited, "2026-09-21")).toBe(1);
  });

  it("schedules nothing before the first version", () => {
    const late: Student = { ...student, schedule: [{ from: "2026-09-15", slots: student.schedule[0].slots }] };
    expect(scheduledDates(late, "2026-09")[0]).toBe("2026-09-15");
  });
});

describe("group membership dates", () => {
  it("counts a group's days only from when it was created", () => {
    const newer = { ...wednesdays, createdOn: "2026-09-20", members: [{ studentId: "s1", joinedOn: "2026-09-20" }] };
    const dates = scheduledDates(student, "2026-09", [newer]).filter((d) => !scheduledDates(student, "2026-09").includes(d));
    expect(dates).toEqual(["2026-09-23", "2026-09-30"]);
  });

  it("counts them for a later member only from their join date", () => {
    const later = {
      ...wednesdays,
      members: [
        { studentId: "s1", joinedOn: "2026-01-01" },
        { studentId: "w1", joinedOn: "2026-09-16" },
      ],
    };
    expect(scheduledDates(walkIn, "2026-09", [later])).toEqual(["2026-09-16", "2026-09-23", "2026-09-30"]);
    expect(scheduledDates(student, "2026-09", [later])).toContain("2026-09-02");
  });

  it("stops the day a member leaves, and the day the group is deleted", () => {
    const left = { ...wednesdays, members: [{ studentId: "w1", joinedOn: "2026-01-01", leftOn: "2026-09-16" }] };
    expect(scheduledDates(walkIn, "2026-09", [left])).toEqual(["2026-09-02", "2026-09-09"]);
    const deleted = { ...wednesdays, deletedOn: "2026-09-23" };
    expect(scheduledDates(walkIn, "2026-09", [deleted])).toEqual(["2026-09-02", "2026-09-09", "2026-09-16"]);
  });
});
