import type { AbsenceCode, DB, Goal, ScheduleSlot, SessionEntry, Student } from "./types";
import { categoryOf } from "./goals";
import { dateKey, daysInMonth, fiscalMonths, todayISO } from "./fy";
import { makeEntry, scheduledHours, slotOn } from "./logic";

type Spec = {
  id: string;
  name: string;
  tutorId: string;
  site: string;
  schedule: ScheduleSlot[];
  startedOn: string;
  /** Catalog goals: code -> date attained, or null while still being worked on. */
  goals: Record<string, string | null>;
  otherGoals?: { label: string; attainedOn: string | null }[];
  skipRate: number;
  /** Leave the most recent scheduled day unlogged, so the demo shows a gap. */
  leaveGap?: boolean;
};

function weekly(weekdays: number[], startTime: string, endTime: string): ScheduleSlot[] {
  return weekdays.map((weekday) => ({ weekday, startTime, endTime }));
}

const SPECS: Spec[] = [
  {
    id: "s-amina",
    name: "Amina Diallo",
    tutorId: "t-maria",
    site: "Bloomfield Public Library",
    schedule: weekly([2, 4], "18:00", "19:30"),
    startedOn: "2026-07-07",
    goals: { D2: "2026-08-18", C6: "2026-09-03", B4: null },
    otherGoals: [{ label: "Pass NJ driver's written test", attainedOn: null }],
    skipRate: 0.12,
  },
  {
    id: "s-luis",
    name: "Luis Ferreira",
    tutorId: "t-maria",
    site: "Bloomfield Public Library",
    schedule: weekly([6], "10:00", "12:00"),
    startedOn: "2026-07-11",
    goals: { A1: "2026-09-08", A2: null },
    skipRate: 0.18,
  },
  {
    id: "s-rosa",
    name: "Rosa Beltrán",
    tutorId: "t-maria",
    site: "Clifton Memorial Library",
    schedule: weekly([1, 3], "13:00", "14:00"),
    startedOn: "2026-07-06",
    goals: { C5: null, D1: null },
    skipRate: 0.25,
    leaveGap: true,
  },
];

const HOLIDAYS = new Set(["2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25"]);

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
  return spec.leaveGap ? out.filter((e) => e.date !== lastScheduled) : out;
}

function entry(
  studentId: string,
  date: string,
  value: { hours: number } | { code: AbsenceCode },
): SessionEntry {
  return makeEntry(
    { id: `e-${studentId}-${date}`, studentId, date, loggedAt: `${date}T21:00:00.000Z` },
    value,
  );
}

function goalsFor(spec: Spec): Goal[] {
  return [
    ...Object.entries(spec.goals).map(
      ([code, attainedOn]): Goal => ({
        id: `g-${spec.id}-${code}`,
        studentId: spec.id,
        catalogKey: code,
        category: categoryOf(code),
        addedDate: spec.startedOn,
        ...(attainedOn ? { attainedDate: attainedOn } : {}),
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
  const today = todayISO();

  const students: Student[] = SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    tutorId: spec.tutorId,
    site: spec.site,
    schedule: spec.schedule,
    status: "active",
    startedOn: spec.startedOn,
  }));

  const sent = (studentId: string, month: string, sentAt: string) =>
    ({ studentId, month, status: "sent", sentAt }) as const;

  return {
    tutors: [{ id: "t-maria", name: "Maria Okonkwo", email: "maria.o@example.org" }],
    students,
    entries: SPECS.flatMap((spec, i) => buildEntries(spec, students[i], months, today)),
    goals: SPECS.flatMap(goalsFor),
    reports: [
      sent("s-amina", months[0], "2026-08-02T14:02:00.000Z"),
      sent("s-amina", months[1], "2026-09-01T09:40:00.000Z"),
      sent("s-luis", months[0], "2026-08-03T18:20:00.000Z"),
      sent("s-rosa", months[0], "2026-08-04T12:10:00.000Z"),
    ],
  };
}
