/**
 * Every change to the DB as a pure function of the previous DB. The store
 * wraps these in setState; tests call them directly.
 */

import type { AbsenceCode, DB, Goal, Group, ScheduleSlot, SessionDetails, SessionEntry, SharedGoal, Student } from "./types";
import { categoryOf, type GoalStage } from "./goals";
import { monthKey } from "./fy";
import { currentMemberIds, isMonthSent, makeEntry, sameGoal } from "./logic";
import { currentSlots, sameSlots, withSchedule } from "./schedule";

export type EntryValue = { hours: number } | { code: AbsenceCode };

/** One student's line in a save: several lines saved together are a group session. */
export type SaveLine = { studentId: string; value: EntryValue };

export type SaveResult = {
  db: DB;
  /** Students whose entry was written. */
  saved: string[];
  /** Students skipped because that month is already sent. */
  locked: string[];
};

/**
 * Writes one entry per line for the date, replacing whatever each student
 * already has that day (and keeping its id). Two or more lines share a new
 * groupId; a single line keeps the group it was logged with. Students whose
 * month is sent are skipped. Logging a day clears any dismissal of it.
 */
export function saveSession(
  db: DB,
  date: string,
  lines: SaveLine[],
  opts: { newId: (prefix: string) => string; now: string },
): SaveResult {
  const month = monthKey(date);
  const locked = lines.map((l) => l.studentId).filter((id) => isMonthSent(db.reports, id, month));
  const writable = lines.filter((l) => !locked.includes(l.studentId));
  const saved = writable.map((l) => l.studentId);
  if (saved.length === 0) return { db, saved, locked };

  const groupId = writable.length > 1 ? opts.newId("grp") : undefined;
  const existing = new Map(
    db.entries.filter((e) => e.date === date).map((e) => [e.studentId, e]),
  );
  const written: SessionEntry[] = writable.map(({ studentId, value }) => {
    const before = existing.get(studentId);
    return makeEntry(
      {
        id: before?.id ?? opts.newId("e"),
        studentId,
        date,
        groupId: groupId ?? before?.groupId,
        loggedAt: opts.now,
        // Changing what the day holds keeps the note written about it.
        ...(before?.note ? { note: before.note } : {}),
      },
      value,
    );
  });

  return {
    db: {
      ...db,
      entries: [
        ...db.entries.filter((e) => !(e.date === date && saved.includes(e.studentId))),
        ...written,
      ],
      dismissals: db.dismissals.filter((d) => !(d.date === date && saved.includes(d.studentId))),
    },
    saved,
    locked,
  };
}

/** A session note is capped at this many words. */
export const NOTE_MAX_WORDS = 50;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Sets the note on the student's entry for the date; an empty note removes
 * it. No entry that day means nothing to attach it to, so nothing changes.
 * Text past the word cap is dropped.
 */
export function setEntryNote(db: DB, studentId: string, date: string, note: string): DB {
  const words = note.trim().split(/\s+/);
  const capped =
    words.length > NOTE_MAX_WORDS ? words.slice(0, NOTE_MAX_WORDS).join(" ") : note;
  return {
    ...db,
    entries: db.entries.map((e) => {
      if (e.studentId !== studentId || e.date !== date) return e;
      const next = { ...e };
      if (capped.trim()) next.note = capped;
      else delete next.note;
      return next;
    }),
  };
}

export type WhenWhereInput = { startTime?: string; endTime?: string; site?: string };

/**
 * Sets when and where the student's session on the date happens, logged or
 * not. Blank fields fall back to the schedule's time or the student's site;
 * all blank removes the record.
 */
export function setSessionDetails(db: DB, studentId: string, date: string, input: WhenWhereInput): DB {
  const next: SessionDetails = { studentId, date };
  for (const key of ["startTime", "endTime", "site"] as const) {
    const value = input[key]?.trim();
    if (value) next[key] = value;
  }
  const rest = (db.sessionDetails ?? []).filter((d) => !(d.studentId === studentId && d.date === date));
  const empty = !next.startTime && !next.endTime && !next.site;
  return { ...db, sessionDetails: empty ? rest : [...rest, next] };
}

export function clearEntry(db: DB, studentId: string, date: string): DB {
  return {
    ...db,
    entries: db.entries.filter((e) => !(e.studentId === studentId && e.date === date)),
  };
}

/* ---------- dismissals ---------- */

export function dismissDay(db: DB, studentId: string, date: string): DB {
  if (db.dismissals.some((d) => d.studentId === studentId && d.date === date)) return db;
  return { ...db, dismissals: [...db.dismissals, { studentId, date }] };
}

export function undismissDay(db: DB, studentId: string, date: string): DB {
  return {
    ...db,
    dismissals: db.dismissals.filter((d) => !(d.studentId === studentId && d.date === date)),
  };
}

/* ---------- month reports ---------- */

/** Sends the month. Nothing blocks it: the review before sending is advice, not a gate. */
export function sendMonth(db: DB, studentId: string, month: string, now: string): DB {
  return {
    ...db,
    reports: [
      ...db.reports.filter((r) => !(r.studentId === studentId && r.month === month)),
      { studentId, month, status: "sent", sentAt: now },
    ],
  };
}

export function reopenMonth(db: DB, studentId: string, month: string): DB {
  return {
    ...db,
    reports: [
      ...db.reports.filter((r) => !(r.studentId === studentId && r.month === month)),
      { studentId, month, status: "open" },
    ],
  };
}

/* ---------- goals ---------- */

export function addGoal(
  db: DB,
  goal: { id: string; studentId: string; addedDate: string } & (
    | { catalogKey: string }
    | { customLabel: string }
  ),
): DB {
  const next: Goal =
    "catalogKey" in goal
      ? { ...goal, category: categoryOf(goal.catalogKey) }
      : { ...goal, category: "other" };
  return { ...db, goals: [...db.goals, next] };
}

/** Removing a goal drops it everywhere, including achievements already reported. */
export function removeGoal(db: DB, goalId: string): DB {
  return { ...db, goals: db.goals.filter((g) => g.id !== goalId) };
}

/**
 * Puts a goal back exactly as it was, dates included: re-adds a removed one,
 * or rolls back a stage change. For undo.
 */
export function restoreGoal(db: DB, goal: Goal): DB {
  if (!db.goals.some((g) => g.id === goal.id)) return { ...db, goals: [...db.goals, goal] };
  return { ...db, goals: db.goals.map((g) => (g.id === goal.id ? goal : g)) };
}

export function setGoalAttained(db: DB, goalId: string, on: string | null): DB {
  return {
    ...db,
    goals: db.goals.map((g) => {
      if (g.id !== goalId) return g;
      const next: Goal = { ...g, attainedDate: on ?? undefined };
      if (!on) delete next.attainedDate;
      return next;
    }),
  };
}

/**
 * Moves a goal on the board. Starting stamps `on` as the start date unless it
 * has one; attaining stamps `on` as the date attained; going back clears
 * whichever stamps no longer apply.
 */
export function setGoalStage(db: DB, goalId: string, stage: GoalStage, on: string): DB {
  return {
    ...db,
    goals: db.goals.map((g) => {
      if (g.id !== goalId) return g;
      const next: Goal = { ...g };
      if (stage === "todo") delete next.startedDate;
      else next.startedDate = g.startedDate ?? on;
      if (stage === "done") next.attainedDate = g.attainedDate ?? on;
      else delete next.attainedDate;
      return next;
    }),
  };
}

/* ---------- students ---------- */

export function updateStudent(db: DB, studentId: string, fn: (s: Student) => Student): DB {
  return { ...db, students: db.students.map((s) => (s.id === studentId ? fn(s) : s)) };
}

/** The new slots apply from `from` (today, normally) onward; earlier dates keep the old ones. */
export function setStudentSchedule(db: DB, studentId: string, slots: ScheduleSlot[], from: string): DB {
  return updateStudent(db, studentId, (s) =>
    sameSlots(slots, currentSlots(s.schedule)) ? s : { ...s, schedule: withSchedule(s.schedule, from, slots) },
  );
}

/* ---------- groups ---------- */

export type GroupInput = {
  name: string;
  memberIds: string[];
  /** Empty for a group with no regular days. */
  slots: ScheduleSlot[];
  sharedGoals?: SharedGoal[];
  note?: string;
};

/** A group's note is capped at this many words. */
export const GROUP_NOTE_MAX_WORDS = 200;

function capWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  return words.length > max ? words.slice(0, max).join(" ") : text.trim();
}

/** Group fields that aren't membership or schedule, tidied for storage. */
function groupExtras(input: Partial<GroupInput>): Partial<Group> {
  const out: Partial<Group> = {};
  if (input.sharedGoals !== undefined) out.sharedGoals = input.sharedGoals;
  if (input.note !== undefined) out.note = capWords(input.note, GROUP_NOTE_MAX_WORDS);
  return out;
}

/**
 * Gives every current member of the group each of its shared goals they
 * don't already have, added today and not started. Goals a member already
 * holds (shared or their own) are left as they are, progress included.
 */
export function applySharedGoals(
  db: DB,
  groupId: string,
  today: string,
  newId: (prefix: string) => string,
): DB {
  const group = db.groups.find((g) => g.id === groupId);
  if (!group?.sharedGoals?.length) return db;
  let next = db;
  for (const studentId of currentMemberIds(group)) {
    for (const shared of group.sharedGoals) {
      if (next.goals.some((g) => g.studentId === studentId && sameGoal(g, shared))) continue;
      next = addGoal(next, { id: newId("g"), studentId, addedDate: today, ...shared });
    }
  }
  return next;
}

/** A new group starts today: no past date becomes scheduled because of it. */
export function addGroup(db: DB, group: { id: string; tutorId: string } & GroupInput, today: string): DB {
  return {
    ...db,
    groups: [
      ...db.groups,
      {
        id: group.id,
        tutorId: group.tutorId,
        name: group.name,
        createdOn: today,
        members: group.memberIds.map((studentId) => ({ studentId, joinedOn: today })),
        schedule: group.slots.length ? [{ from: today, slots: group.slots }] : [],
        ...groupExtras(group),
      },
    ],
  };
}

/**
 * Renames, changes members and changes the schedule, all as of `today`.
 * New members join today, removed ones leave today, and a new schedule takes
 * effect today; nothing before today changes.
 */
export function updateGroup(db: DB, groupId: string, patch: Partial<GroupInput>, today: string): DB {
  return {
    ...db,
    groups: db.groups.map((g): Group => {
      if (g.id !== groupId) return g;
      let next: Group = patch.name !== undefined ? { ...g, name: patch.name } : g;
      next = { ...next, ...groupExtras(patch) };

      if (patch.memberIds) {
        const now = currentMemberIds(g);
        const keep = new Set(patch.memberIds);
        next = {
          ...next,
          members: [
            ...next.members.map((m) =>
              !m.leftOn && !keep.has(m.studentId) ? { ...m, leftOn: today } : m,
            ),
            ...patch.memberIds
              .filter((id) => !now.includes(id))
              .map((studentId) => ({ studentId, joinedOn: today })),
          ],
        };
      }

      if (patch.slots && !sameSlots(patch.slots, currentSlots(g.schedule))) {
        next = { ...next, schedule: withSchedule(g.schedule, today, patch.slots) };
      }
      return next;
    }),
  };
}

/**
 * Deleting stamps the date; the group drops out of every list, but its past
 * scheduled days and the entries logged for it stay exactly as they were.
 */
export function removeGroup(db: DB, groupId: string, today: string): DB {
  return {
    ...db,
    groups: db.groups.map((g) => (g.id === groupId && !g.deletedOn ? { ...g, deletedOn: today } : g)),
  };
}

/** Fills in collections an older cache didn't have. */
export function withDefaults(db: Partial<DB> & Pick<DB, "tutors" | "students" | "entries">): DB {
  return {
    goals: [],
    reports: [],
    groups: [],
    dismissals: [],
    sessionDetails: [],
    ...db,
  };
}

/**
 * Brings in any tutor the seed has and this DB doesn't, with their students,
 * groups and everything recorded for them. Lets a demo tutor added to the
 * seed reach a browser that already has saved data, without touching what's
 * there. Once saved, the tutor is present and nothing is added again.
 */
export function addMissingTutors(db: DB, seed: DB): DB {
  const have = new Set(db.tutors.map((t) => t.id));
  const tutors = seed.tutors.filter((t) => !have.has(t.id));
  if (tutors.length === 0) return db;
  const tutorIds = new Set(tutors.map((t) => t.id));
  const haveStudents = new Set(db.students.map((s) => s.id));
  const students = seed.students.filter((s) => tutorIds.has(s.tutorId) && !haveStudents.has(s.id));
  const ids = new Set(students.map((s) => s.id));
  const theirs = <T extends { studentId: string }>(list: T[] | undefined) =>
    (list ?? []).filter((x) => ids.has(x.studentId));
  return {
    ...db,
    tutors: [...db.tutors, ...tutors],
    students: [...db.students, ...students],
    entries: [...db.entries, ...theirs(seed.entries)],
    goals: [...db.goals, ...theirs(seed.goals)],
    reports: [...db.reports, ...theirs(seed.reports)],
    dismissals: [...db.dismissals, ...theirs(seed.dismissals)],
    sessionDetails: [...(db.sessionDetails ?? []), ...theirs(seed.sessionDetails)],
    groups: [...db.groups, ...seed.groups.filter((g) => tutorIds.has(g.tutorId))],
  };
}
