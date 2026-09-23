import type { AbsenceCode, DB, Goal, Group, ScheduleSlot, SessionEntry, Student } from "./types";
import { categoryOf } from "./goals";
import { addDays, dateKey, daysInMonth, fiscalMonths, monthKey, todayISO } from "./fy";
import {
  enrolledOn,
  expectsReport,
  groupSlotOn,
  makeEntry,
  memberOn,
  scheduledHours,
  slotOn,
} from "./logic";
import { slotHours } from "./schedule";

type Spec = {
  id: string;
  name: string;
  tutorId: string;
  site: string;
  schedule: ScheduleSlot[];
  startedOn: string;
  /**
   * Catalog goals: code -> date attained, `{ started }` while in progress, or
   * null when not started yet.
   */
  goals: Record<string, string | { started: string } | null>;
  otherGoals?: { label: string; attainedOn: string | null }[];
  skipRate: number;
  /** Leave the most recent scheduled day unlogged, so the demo shows an unlogged day. */
  leaveUnlogged?: boolean;
  /** Stopped being tutored: nothing is scheduled after `on`. */
  stopped?: { on: string; reason: string };
};

function weekly(weekdays: number[], startTime: string, endTime: string): ScheduleSlot[] {
  return weekdays.map((weekday) => ({ weekday, startTime, endTime }));
}

/**
 * Every slot sits inside its site's open hours (lib/sites), and no tutor's
 * slots overlap. Maria's three come first, then Dennis's.
 */
const SPECS: Spec[] = [
  {
    id: "s-amina",
    name: "Amina Diallo",
    tutorId: "t-maria",
    site: "Bloomfield Public Library",
    schedule: weekly([1, 4], "10:00", "11:30"),
    startedOn: "2026-07-07",
    goals: { D2: "2026-08-18", C6: "2026-09-03", B4: null },
    otherGoals: [{ label: "Pass NJ driver's written test", attainedOn: null }],
    skipRate: 0.12,
  },
  {
    id: "s-luis",
    name: "Luis Ferreira",
    tutorId: "t-maria",
    site: "Passaic Public Library",
    schedule: weekly([2], "10:00", "12:00"),
    startedOn: "2026-07-11",
    goals: { A1: "2026-09-08", A2: null },
    skipRate: 0.18,
  },
  {
    id: "s-rosa",
    name: "Rosa Beltrán",
    tutorId: "t-maria",
    site: "Bloomfield Public Library",
    schedule: weekly([1, 3], "13:00", "14:00"),
    startedOn: "2026-07-06",
    goals: { C5: null, D1: null },
    skipRate: 0.25,
    leaveUnlogged: true,
  },

  // Dennis Whitaker's students.
  {
    id: "s-kwame",
    name: "Kwame Osei",
    tutorId: "t-dennis",
    site: "Bloomfield Public Library",
    schedule: weekly([2, 4], "13:00", "14:30"),
    // Tutored through all of FY 2025–26 too, so there are finished years to report.
    startedOn: "2025-07-08",
    goals: {
      A1: "2025-11-18",
      D2: "2026-03-10",
      B4: "2026-08-26",
      A2: { started: "2026-08-04" },
      C5: null,
    },
    skipRate: 0.1,
  },
  {
    id: "s-mei",
    name: "Mei Tanaka",
    tutorId: "t-dennis",
    site: "Passaic Public Library",
    schedule: weekly([2], "10:00", "11:30"),
    startedOn: "2025-07-15",
    goals: {
      C4: "2025-10-02",
      C6: "2026-02-12",
      C5: "2026-07-30",
      C2: "2026-09-10",
      A1: { started: "2026-09-01" },
    },
    otherGoals: [{ label: "Read a chapter book with her son", attainedOn: null }],
    skipRate: 0.15,
    leaveUnlogged: true,
  },
  {
    id: "s-hector",
    name: "Héctor Rivas",
    tutorId: "t-dennis",
    site: "Bloomfield Public Library",
    schedule: weekly([1, 3], "10:00", "11:30"),
    startedOn: "2026-07-08",
    goals: { D1: "2026-08-13", D4: null },
    skipRate: 0.2,
    stopped: { on: "2026-09-14", reason: "Moved out of the county for work." },
  },
  {
    // A finished story: tutored for most of FY 2025–26, then stopped.
    id: "s-ana",
    name: "Ana Souza",
    tutorId: "t-dennis",
    site: "Bloomfield Public Library",
    schedule: weekly([1, 3], "13:00", "14:30"),
    startedOn: "2025-09-08",
    goals: { A1: "2026-04-14", B4: "2026-05-20", B3: { started: "2026-05-20" } },
    otherGoals: [{ label: "Open a bank account", attainedOn: "2025-12-09" }],
    skipRate: 0.12,
    stopped: {
      on: "2026-05-27",
      reason: "Earned her high school diploma and started a full-time job.",
    },
  },
];

/**
 * Amina and Luis also meet together at Bloomfield late on Wednesday mornings.
 * The group started three weeks ago, and every meeting since is logged, so it
 * shows real use without inventing a backlog of unlogged Wednesdays.
 */
function groupsFor(today: string): Group[] {
  const createdOn = addDays(today, -21);
  return [
    {
      id: "grp-citizenship",
      tutorId: "t-maria",
      name: "Citizenship circle",
      createdOn,
      members: [
        { studentId: "s-amina", joinedOn: createdOn },
        { studentId: "s-luis", joinedOn: createdOn },
      ],
      schedule: [{ from: createdOn, slots: weekly([3], "11:00", "12:30") }],
    },
    {
      // Kwame and Mei read together on Wednesday afternoons, a day neither
      // has a session of their own (a day holds one entry per student).
      id: "grp-reading",
      tutorId: "t-dennis",
      name: "Parents' reading group",
      createdOn: addDays(today, -28),
      members: [
        { studentId: "s-kwame", joinedOn: addDays(today, -28) },
        { studentId: "s-mei", joinedOn: addDays(today, -28) },
      ],
      schedule: [{ from: addDays(today, -28), slots: weekly([3], "13:00", "14:30") }],
      sharedGoals: [{ catalogKey: "C5" }],
      note: "Picture books and early chapter books to read at home. Each brings one book a week.",
    },
  ];
}

const HOLIDAYS = new Set([
  // FY 2025–26
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-19",
  "2026-05-25",
  // FY 2026–27
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
]);

/** Deterministic 0..1 pseudo-random so the demo data is stable across reloads. */
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function buildEntries(spec: Spec, student: Student, months: string[], today: string): SessionEntry[] {
  const out: SessionEntry[] = [];
  let lastScheduled: string | null = null;
  for (const month of months) {
    for (let day = 1; day <= daysInMonth(month); day++) {
      const date = dateKey(month, day);
      // Today is left open so the "Today" card has something to do.
      if (date >= today || !slotOn(student, date)) continue;
      lastScheduled = date;

      const hours = scheduledHours(student, date) ?? 0;
      const roll = rand(spec.id + date);
      if (HOLIDAYS.has(date)) out.push(entry(spec.id, date, { code: "H" }));
      else if (roll < spec.skipRate * 0.6) out.push(entry(spec.id, date, { code: "SA" }));
      else if (roll < spec.skipRate) out.push(entry(spec.id, date, { code: "TA" }));
      else out.push(entry(spec.id, date, { hours: hours + (roll > 0.9 ? 0.5 : 0) }));
    }
  }
  return spec.leaveUnlogged ? out.filter((e) => e.date !== lastScheduled) : out;
}

/** One entry per member per group meeting, sharing a groupId; a member now and then absent. */
function buildGroupEntries(group: Group, students: Student[], months: string[], today: string): SessionEntry[] {
  const out: SessionEntry[] = [];
  for (const month of months) {
    for (let day = 1; day <= daysInMonth(month); day++) {
      const date = dateKey(month, day);
      const slot = groupSlotOn(group, date);
      if (date >= today || !slot) continue;
      const groupId = `${group.id}-${date}`;
      const tutorAway = rand(group.id + date) < 0.08;
      for (const s of students.filter((m) => memberOn(group, m.id, date) && enrolledOn(m, date))) {
        const value: { hours: number } | { code: AbsenceCode } = HOLIDAYS.has(date)
          ? { code: "H" }
          : tutorAway
            ? { code: "TA" }
            : rand(s.id + group.id + date) < 0.15
              ? { code: "SA" }
              : { hours: slotHours(slot) };
        out.push(entry(s.id, date, value, groupId));
      }
    }
  }
  return out;
}

function entry(
  studentId: string,
  date: string,
  value: { hours: number } | { code: AbsenceCode },
  groupId?: string,
): SessionEntry {
  return makeEntry(
    { id: `e-${studentId}-${date}`, studentId, date, groupId, loggedAt: `${date}T21:00:00.000Z` },
    value,
  );
}

function goalsFor(spec: Spec): Goal[] {
  return [
    ...Object.entries(spec.goals).map(
      ([code, state]): Goal => ({
        id: `g-${spec.id}-${code}`,
        studentId: spec.id,
        catalogKey: code,
        category: categoryOf(code),
        addedDate: spec.startedOn,
        ...(typeof state === "string" ? { attainedDate: state } : {}),
        ...(state && typeof state === "object" ? { startedDate: state.started } : {}),
      }),
    ),
    ...(spec.otherGoals ?? []).map(
      (g, i): Goal => ({
        id: `g-${spec.id}-other${i}`,
        studentId: spec.id,
        customLabel: g.label,
        category: "other",
        addedDate: spec.startedOn,
        ...(g.attainedOn ? { attainedDate: g.attainedOn } : {}),
      }),
    ),
  ];
}

export function buildSeed(fy: number): DB {
  const months = fiscalMonths(fy);
  // The year before, so Dennis's students have a finished year on record.
  const lastYear = fiscalMonths(fy - 1);
  const today = todayISO();

  const students: Student[] = SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    tutorId: spec.tutorId,
    site: spec.site,
    schedule: [{ from: spec.startedOn, slots: spec.schedule }],
    startedOn: spec.startedOn,
    ...(spec.stopped
      ? { status: "stopped", stoppedDate: spec.stopped.on, stoppedReason: spec.stopped.reason }
      : { status: "active" }),
  }));

  const groups = groupsFor(today);

  const sent = (studentId: string, month: string, sentAt: string) =>
    ({ studentId, month, status: "sent", sentAt }) as const;

  return {
    tutors: [
      { id: "t-maria", name: "Maria Okonkwo", email: "maria.o@example.org" },
      { id: "t-dennis", name: "Dennis Whitaker", email: "d.whitaker@example.org" },
    ],
    students,
    entries: [
      ...SPECS.flatMap((spec, i) =>
        buildEntries(spec, students[i], [...lastYear, ...months], today),
      ),
      ...groups.flatMap((g) => buildGroupEntries(g, students, months, today)),
    ],
    groups,
    dismissals: [],
    sessionDetails: [],
    goals: SPECS.flatMap(goalsFor),
    reports: [
      sent("s-amina", months[0], "2026-08-02T14:02:00.000Z"),
      sent("s-amina", months[1], "2026-09-01T09:40:00.000Z"),
      sent("s-luis", months[0], "2026-08-03T18:20:00.000Z"),
      sent("s-rosa", months[0], "2026-08-04T12:10:00.000Z"),
      sent("s-kwame", months[0], "2026-08-01T20:15:00.000Z"),
      sent("s-kwame", months[1], "2026-09-02T20:05:00.000Z"),
      sent("s-mei", months[0], "2026-08-05T08:30:00.000Z"),
      sent("s-mei", months[1], "2026-09-03T08:12:00.000Z"),
      sent("s-hector", months[0], "2026-08-06T16:45:00.000Z"),
      // Every month of last year confirmed, a few days after it closed.
      ...["s-kwame", "s-mei", "s-ana"].flatMap((id, i) => {
        const student = students.find((s) => s.id === id)!;
        return lastYear
          .filter((m) => expectsReport(student, m) && m >= monthKey(student.startedOn!))
          .map((m) => sent(id, m, `${monthKey(addDays(dateKey(m, 28), 7))}-0${2 + i}T19:30:00.000Z`));
      }),
    ],
  };
}
