import { describe, expect, it } from "vitest";
import type { DB } from "./types";
import * as m from "./mutations";
import { activeGroups, monthSummary, scheduledDates, unloggedDays, whenWhere } from "./logic";

const WED_EVENING = { weekday: 3, startTime: "18:00", endTime: "19:30" };
const SAT_MORNING = { weekday: 6, startTime: "10:00", endTime: "11:30" };

function db(partial: Partial<DB> = {}): DB {
  return {
    tutors: [{ id: "t1", name: "T", email: "t@x" }],
    students: ["a", "b", "c"].map((id) => ({
      id,
      name: id.toUpperCase(),
      tutorId: "t1",
      site: "Lib",
      schedule: [{ from: "2026-01-01", slots: [WED_EVENING] }],
      status: "active" as const,
    })),
    entries: [],
    goals: [],
    reports: [],
    groups: [],
    dismissals: [],
    ...partial,
  };
}

let i = 0;
const opts = { newId: (p: string) => `${p}-${i++}`, now: "2026-09-23T20:00:00.000Z" };

describe("saveSession: a group with a mixed absent member", () => {
  const before = db();
  const { db: after, saved } = m.saveSession(before, "2026-09-23", [
    { studentId: "a", value: { hours: 1.5 } },
    { studentId: "b", value: { code: "SA" } },
    { studentId: "c", value: { hours: 1 } },
  ], opts);

  it("writes one entry per student", () => {
    expect(saved).toEqual(["a", "b", "c"]);
    expect(after.entries).toHaveLength(3);
  });

  it("gives them all the same groupId", () => {
    const ids = new Set(after.entries.map((e) => e.groupId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBeTruthy();
  });

  it("keeps each member's own value", () => {
    const by = Object.fromEntries(after.entries.map((e) => [e.studentId, e.code ?? e.hours]));
    expect(by).toEqual({ a: 1.5, b: "SA", c: 1 });
  });

  it("counts the absent member as missed, not as a session", () => {
    const b = after.students[1];
    const s = monthSummary(b, "2026-09", after, "2026-09-24");
    expect(s).toMatchObject({ sessions: 0, missed: 1, hours: 0 });
  });

  it("edits in place when saved again, without duplicates", () => {
    const again = m.saveSession(after, "2026-09-23", [{ studentId: "b", value: { hours: 1.5 } }], opts).db;
    expect(again.entries).toHaveLength(3);
    const b = again.entries.find((e) => e.studentId === "b")!;
    expect(b.hours).toBe(1.5);
    // Keeps its id and the group it was logged with.
    const original = after.entries.find((e) => e.studentId === "b")!;
    expect(b.id).toBe(original.id);
    expect(b.groupId).toBe(original.groupId);
  });
});

describe("saveSession: sent months", () => {
  it("skips a student whose month is sent and saves the rest", () => {
    const sent = db({ reports: [{ studentId: "a", month: "2026-09", status: "sent", sentAt: "x" }] });
    const r = m.saveSession(sent, "2026-09-23", [
      { studentId: "a", value: { hours: 1 } },
      { studentId: "b", value: { hours: 1 } },
    ], opts);
    expect(r.locked).toEqual(["a"]);
    expect(r.saved).toEqual(["b"]);
    expect(r.db.entries.map((e) => e.studentId)).toEqual(["b"]);
  });
});

describe("sendMonth never blocks", () => {
  it("sends a month full of unlogged days", () => {
    const start = db();
    const a = start.students[0];
    expect(unloggedDays(a, "2026-09", start, "2026-09-30").length).toBeGreaterThan(0);
    const after = m.sendMonth(start, "a", "2026-09", "now");
    expect(after.reports).toEqual([{ studentId: "a", month: "2026-09", status: "sent", sentAt: "now" }]);
  });

  it("sends a month with no sessions at all, and reopens it", () => {
    const after = m.reopenMonth(m.sendMonth(db(), "c", "2026-08", "now"), "c", "2026-08");
    expect(after.reports).toEqual([{ studentId: "c", month: "2026-08", status: "open" }]);
  });
});

describe("dismissals", () => {
  it("drops the day from the unlogged count, and undoing brings it back", () => {
    const start = db();
    const a = start.students[0];
    const before = unloggedDays(a, "2026-09", start, "2026-09-20");
    expect(before).toContain("2026-09-16");

    const dismissed = m.dismissDay(start, "a", "2026-09-16");
    expect(unloggedDays(a, "2026-09", dismissed, "2026-09-20")).not.toContain("2026-09-16");
    expect(m.dismissDay(dismissed, "a", "2026-09-16").dismissals).toHaveLength(1);

    const undone = m.undismissDay(dismissed, "a", "2026-09-16");
    expect(unloggedDays(a, "2026-09", undone, "2026-09-20")).toEqual(before);
  });

  it("is cleared when the day is logged after all", () => {
    const dismissed = m.dismissDay(db(), "a", "2026-09-16");
    const logged = m.saveSession(dismissed, "2026-09-16", [{ studentId: "a", value: { hours: 1 } }], opts).db;
    expect(logged.dismissals).toEqual([]);
  });
});

describe("groups", () => {
  const group = (memberIds: string[], slots = [SAT_MORNING]) =>
    ({ id: "g", tutorId: "t1", name: "G", memberIds, slots });

  it("never deletes entries when a group goes, and keeps its past days scheduled", () => {
    const withGroup = m.addGroup(db(), group(["a", "b"]), "2026-09-01");
    const logged = m.saveSession(withGroup, "2026-09-12", [
      { studentId: "a", value: { hours: 1 } },
      { studentId: "b", value: { hours: 1 } },
    ], opts).db;
    const gone = m.removeGroup(logged, "g", "2026-09-20");
    expect(activeGroups(gone.groups)).toEqual([]);
    expect(gone.entries).toEqual(logged.entries);
    const a = gone.students[0];
    // Saturdays 5, 12 and 19 stay scheduled; the 26th, after deletion, doesn't.
    expect(scheduledDates(a, "2026-09", gone.groups)).toEqual(expect.arrayContaining(["2026-09-05", "2026-09-19"]));
    expect(scheduledDates(a, "2026-09", gone.groups)).not.toContain("2026-09-26");
  });

  it("creating a group today adds no past unlogged days", () => {
    const before = db();
    const a = before.students[0];
    const past = unloggedDays(a, "2026-09", before, "2026-09-22");
    const after = m.addGroup(before, group(["a", "b"]), "2026-09-22");
    expect(unloggedDays(a, "2026-09", after, "2026-09-22")).toEqual(past);
    // Its first Saturday counts once it has passed.
    expect(unloggedDays(a, "2026-09", after, "2026-09-27")).toContain("2026-09-26");
  });

  it("a member added later only gets dates from their join date", () => {
    const start = m.addGroup(db(), group(["a"]), "2026-09-01");
    const added = m.updateGroup(start, "g", { memberIds: ["a", "c"] }, "2026-09-15");
    const c = added.students[2];
    const viaGroup = scheduledDates(c, "2026-09", added.groups).filter((d) => !scheduledDates(c, "2026-09").includes(d));
    expect(viaGroup).toEqual(["2026-09-19", "2026-09-26"]);
    expect(added.groups[0].members).toEqual([
      { studentId: "a", joinedOn: "2026-09-01" },
      { studentId: "c", joinedOn: "2026-09-15" },
    ]);
  });

  it("a member taken out keeps their past days and loses the rest", () => {
    const start = m.addGroup(db(), group(["a", "b"]), "2026-09-01");
    const out = m.updateGroup(start, "g", { memberIds: ["a"] }, "2026-09-15");
    const b = out.students[1];
    expect(out.groups[0].members[1]).toEqual({ studentId: "b", joinedOn: "2026-09-01", leftOn: "2026-09-15" });
    const viaGroup = scheduledDates(b, "2026-09", out.groups).filter((d) => !scheduledDates(b, "2026-09").includes(d));
    expect(viaGroup).toEqual(["2026-09-05", "2026-09-12"]);
  });

  it("renames without touching members or schedule", () => {
    const g = m.addGroup(db(), group(["a"]), "2026-09-01");
    const renamed = m.updateGroup(g, "g", { name: "Renamed" }, "2026-09-15");
    expect(renamed.groups[0]).toMatchObject({ name: "Renamed", members: g.groups[0].members, schedule: g.groups[0].schedule });
  });

  it("a group schedule change applies from the edit date only", () => {
    const g = m.addGroup(db(), group(["a"]), "2026-09-01");
    const moved = m.updateGroup(g, "g", { slots: [{ ...SAT_MORNING, weekday: 5 }] }, "2026-09-15");
    const a = moved.students[0];
    const viaGroup = scheduledDates(a, "2026-09", moved.groups).filter((d) => !scheduledDates(a, "2026-09").includes(d));
    // Saturdays 5 and 12, then Fridays 18 and 25.
    expect(viaGroup).toEqual(["2026-09-05", "2026-09-12", "2026-09-18", "2026-09-25"]);
  });
});

describe("withDefaults", () => {
  it("fills in groups and dismissals for a v3 cache", () => {
    const { groups, dismissals, ...v3 } = db();
    void groups;
    void dismissals;
    expect(m.withDefaults(v3)).toMatchObject({ groups: [], dismissals: [] });
  });
});

describe("student schedule edits", () => {
  it("don't change past months, and apply from the edit date", () => {
    const start = db({
      students: [{
        id: "a", name: "A", tutorId: "t1", site: "Lib", status: "active", startedOn: "2026-07-01",
        schedule: [{ from: "2026-07-01", slots: [WED_EVENING] }],
      }],
    });
    const a0 = start.students[0];
    const august = scheduledDates(a0, "2026-08");

    const edited = m.setStudentSchedule(start, "a", [SAT_MORNING], "2026-09-15");
    const a1 = edited.students[0];
    expect(scheduledDates(a1, "2026-08")).toEqual(august);
    expect(scheduledDates(a1, "2026-09")).toEqual([
      "2026-09-02", "2026-09-09", // Wednesdays before the edit
      "2026-09-19", "2026-09-26", // Saturdays after
    ]);
    // Past unlogged days are the same before and after the edit.
    expect(unloggedDays(a1, "2026-08", edited, "2026-09-15")).toEqual(unloggedDays(a0, "2026-08", start, "2026-09-15"));
  });

  it("replaces a same-day edit instead of stacking versions, and ignores a no-op", () => {
    const once = m.setStudentSchedule(db(), "a", [SAT_MORNING], "2026-09-15");
    const twice = m.setStudentSchedule(once, "a", [{ ...SAT_MORNING, endTime: "12:00" }], "2026-09-15");
    expect(twice.students[0].schedule).toHaveLength(2);
    expect(m.setStudentSchedule(twice, "a", twice.students[0].schedule[1].slots, "2026-09-16")).toEqual(twice);
  });
});

describe("removing goals", () => {
  const goal = { id: "g1", studentId: "a", category: "economic" as const, catalogKey: "A1", addedDate: "2026-09-01", attainedDate: "2026-09-10" };

  it("removes the goal, and undo puts back the same goal with its dates", () => {
    const start = db({ goals: [goal] });
    const removed = m.removeGoal(start, "g1");
    expect(removed.goals).toEqual([]);
    expect(m.restoreGoal(removed, goal).goals).toEqual([goal]);
  });

  it("doesn't restore twice", () => {
    expect(m.restoreGoal(db({ goals: [goal] }), goal).goals).toHaveLength(1);
  });
});

describe("goal progress from a session", () => {
  const goal = { id: "g2", studentId: "a", category: "educational" as const, catalogKey: "B4", addedDate: "2026-07-01" };

  it("stamps the session's date, not today's, and undo rolls back to the exact record", () => {
    const start = db({ goals: [goal] });
    const started = m.setGoalStage(start, "g2", "doing", "2026-09-17");
    expect(started.goals[0].startedDate).toBe("2026-09-17");
    const attained = m.setGoalStage(started, "g2", "done", "2026-09-22");
    expect(attained.goals[0]).toMatchObject({ startedDate: "2026-09-17", attainedDate: "2026-09-22" });
    expect(m.restoreGoal(attained, started.goals[0]).goals).toEqual(started.goals);
  });
});

describe("setSessionDetails", () => {
  const WED = "2026-09-23";

  it("moves one session without touching the schedule, logged or not", () => {
    const next = m.setSessionDetails(db(), "a", WED, { startTime: "17:00", endTime: "18:00", site: "Park" });
    const a = next.students[0];
    expect(whenWhere(a, WED, next)).toEqual({ startTime: "17:00", endTime: "18:00", site: "Park", changed: true });
    // The following Wednesday is still the regular slot.
    expect(whenWhere(a, "2026-09-30", next)).toMatchObject({ startTime: "18:00", site: "Lib", changed: false });
    expect(next.entries).toHaveLength(0);
  });

  it("gives an unscheduled day a time, and falls back when cleared", () => {
    const SAT = "2026-09-26";
    let next = m.setSessionDetails(db(), "a", SAT, { startTime: "09:00", endTime: "10:00" });
    expect(whenWhere(next.students[0], SAT, next)).toMatchObject({ startTime: "09:00", site: "Lib" });
    next = m.setSessionDetails(next, "a", SAT, {});
    expect(next.sessionDetails).toEqual([]);
    expect(whenWhere(next.students[0], SAT, next)).toMatchObject({ startTime: null, changed: false });
  });

  it("survives the day being logged and re-logged", () => {
    let next = m.setSessionDetails(db(), "a", WED, { site: "Park" });
    next = m.saveSession(next, WED, [{ studentId: "a", value: { hours: 1 } }], opts).db;
    next = m.saveSession(next, WED, [{ studentId: "a", value: { code: "SA" } }], opts).db;
    expect(whenWhere(next.students[0], WED, next).site).toBe("Park");
  });
});

describe("group shared goals and note", () => {
  const TODAY = "2026-09-22";
  let n = 0;
  const newId = (p: string) => `${p}-sg${n++}`;
  const base = () => m.addGroup(db(), { id: "g1", tutorId: "t1", name: "Circle", memberIds: ["a", "b"], slots: [] }, TODAY);

  it("gives every member each shared goal once, keeping ones they already have", () => {
    let next = m.addGoal(base(), { id: "own", studentId: "a", addedDate: "2026-07-01", catalogKey: "D1" });
    next = m.setGoalStage(next, "own", "doing", "2026-08-01");
    next = m.updateGroup(next, "g1", { sharedGoals: [{ catalogKey: "D1" }, { customLabel: "Pass the civics test" }] }, TODAY);
    next = m.applySharedGoals(next, "g1", TODAY, newId);
    const forA = next.goals.filter((g) => g.studentId === "a");
    const forB = next.goals.filter((g) => g.studentId === "b");
    expect(forA).toHaveLength(2);
    expect(forA.find((g) => g.catalogKey === "D1")?.startedDate).toBe("2026-08-01");
    expect(forB.map((g) => g.catalogKey ?? g.customLabel).sort()).toEqual(["D1", "Pass the civics test"]);
    // Running again adds nothing.
    expect(m.applySharedGoals(next, "g1", TODAY, newId).goals).toHaveLength(next.goals.length);
  });

  it("reaches a member who joins later", () => {
    let next = m.updateGroup(base(), "g1", { sharedGoals: [{ catalogKey: "C5" }] }, TODAY);
    next = m.applySharedGoals(next, "g1", TODAY, newId);
    next = m.applySharedGoals(m.updateGroup(next, "g1", { memberIds: ["a", "b", "c"] }, TODAY), "g1", TODAY, newId);
    expect(next.goals.filter((g) => g.catalogKey === "C5").map((g) => g.studentId).sort()).toEqual(["a", "b", "c"]);
  });

  it("caps the group note at 200 words", () => {
    const long = Array.from({ length: 250 }, (_, i) => `w${i}`).join(" ");
    const next = m.updateGroup(base(), "g1", { note: long }, TODAY);
    expect(m.countWords(next.groups[0].note ?? "")).toBe(m.GROUP_NOTE_MAX_WORDS);
  });
});

describe("addMissingTutors", () => {
  it("adds a seed tutor with their students and records, leaving existing data alone", () => {
    const mine = db({ entries: [{ id: "e1", studentId: "a", date: "2026-09-23", hours: 2 }] });
    const seed: DB = {
      ...db(),
      tutors: [...db().tutors, { id: "t2", name: "New", email: "n@x" }],
      students: [
        ...db().students,
        { id: "z", name: "Z", tutorId: "t2", site: "Lib", schedule: [], status: "active" },
      ],
      entries: [
        { id: "e-seed-a", studentId: "a", date: "2026-09-23", hours: 1 },
        { id: "e-z", studentId: "z", date: "2026-09-23", hours: 1.5 },
      ],
    };
    const merged = m.addMissingTutors(mine, seed);
    expect(merged.tutors.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(merged.students.map((s) => s.id)).toEqual(["a", "b", "c", "z"]);
    expect(merged.entries.map((e) => e.id)).toEqual(["e1", "e-z"]);
    expect(m.addMissingTutors(merged, seed)).toBe(merged);
  });
});
