import { describe, expect, it } from "vitest";
import { migrateLegacy, parseLegacySchedule } from "./migrate";

describe("parseLegacySchedule", () => {
  it("reads two days sharing an evening time", () => {
    expect(parseLegacySchedule("Tue & Thu", "6:00–7:30 pm")).toEqual([
      { weekday: 2, startTime: "18:00", endTime: "19:30" },
      { weekday: 4, startTime: "18:00", endTime: "19:30" },
    ]);
  });

  it("treats 12 as noon", () => {
    expect(parseLegacySchedule("Sat", "10:00–12:00 am")).toEqual([
      { weekday: 6, startTime: "10:00", endTime: "12:00" },
    ]);
  });

  it("keeps a morning start when the range crosses noon", () => {
    expect(parseLegacySchedule("Mon", "11–1 pm")).toEqual([
      { weekday: 1, startTime: "11:00", endTime: "13:00" },
    ]);
  });

  it("gives up rather than guess", () => {
    expect(parseLegacySchedule("", "6–7 pm")).toEqual([]);
    expect(parseLegacySchedule("Tue", "evenings")).toEqual([]);
  });
});

describe("migrateLegacy", () => {
  const migrated = migrateLegacy({
    tutors: [{ id: "t1", name: "T", email: "t@x" }],
    students: [
      {
        id: "s1",
        name: "S",
        tutorId: "t1",
        site: "Lib",
        days: "Wed",
        times: "1:00–2:00 pm",
        startedOn: "2026-07-01",
        goals: { A1: { attainedOn: "2026-08-01" } },
        otherGoals: [{ id: "og1", label: "Driver's test", attainedOn: null }],
        stopped: { on: "2026-09-04", reason: "Moved" },
      },
    ],
    entries: [
      { id: "e1", studentId: "s1", date: "2026-07-01", hours: 1, code: null },
      { id: "e2", studentId: "s1", date: "2026-07-08", hours: 0, code: "T" },
      { id: "e3", studentId: "s1", date: "2026-07-15", hours: 0, code: "SA" },
    ],
    submissions: [{ studentId: "s1", month: "2026-07", submittedAt: "2026-08-01T00:00:00Z" }],
  });

  it("rewrites absence codes to TA/SA", () => {
    expect(migrated.entries.map((e) => e.code ?? e.hours)).toEqual([1, "TA", "SA"]);
  });

  it("carries the stop over as status", () => {
    expect(migrated.students[0]).toMatchObject({
      status: "stopped",
      stoppedDate: "2026-09-04",
      stoppedReason: "Moved",
    });
  });

  it("turns goals into goal records", () => {
    expect(migrated.goals).toEqual([
      expect.objectContaining({ catalogKey: "A1", category: "economic", attainedDate: "2026-08-01" }),
      expect.objectContaining({ customLabel: "Driver's test", category: "other" }),
    ]);
    expect(migrated.goals[1].attainedDate).toBeUndefined();
  });

  it("turns submissions into sent reports", () => {
    expect(migrated.reports).toEqual([
      { studentId: "s1", month: "2026-07", status: "sent", sentAt: "2026-08-01T00:00:00Z" },
    ]);
  });
});
