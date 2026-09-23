import type { DB, Entry, Student } from "./types";
import { dateKey, daysInMonth, fiscalMonths, todayISO, weekdayOf } from "./fy";

type Spec = {
  id: string;
  name: string;
  tutorId: string;
  site: string;
  days: string;
  weekdays: number[];
  times: string;
  hours: number;
  startedOn: string;
  goals: Record<string, string>;
  otherGoals?: { label: string; attainedOn: string | null }[];
  skipRate: number;
  stopped?: { on: string; reason: string };
};

const SPECS: Spec[] = [
  {
    id: "s-amina",
    name: "Amina Diallo",
    tutorId: "t-maria",
    site: "Bloomfield Public Library",
    days: "Tue & Thu",
    weekdays: [2, 4],
    times: "6:00–7:30 pm",
    hours: 1.5,
    startedOn: "2026-07-07",
    goals: { D2: "2026-08-18", C6: "2026-09-03" },
    otherGoals: [{ label: "Pass NJ driver's written test", attainedOn: null }],
    skipRate: 0.12,
  },
  {
    id: "s-luis",
    name: "Luis Ferreira",
    tutorId: "t-maria",
    site: "Bloomfield Public Library",
    days: "Sat",
    weekdays: [6],
    times: "10:00–12:00 am",
    hours: 2,
    startedOn: "2026-07-11",
    goals: { A1: "2026-09-08" },
    skipRate: 0.18,
  },
  {
    id: "s-rosa",
    name: "Rosa Beltrán",
    tutorId: "t-maria",
    site: "Clifton Memorial Library",
    days: "Mon & Wed",
    weekdays: [1, 3],
    times: "1:00–2:00 pm",
    hours: 1,
    startedOn: "2026-07-06",
    goals: {},
    skipRate: 0.25,
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

function buildEntries(spec: Spec, months: string[], today: string): Entry[] {
  const out: Entry[] = [];
  for (const month of months) {
    for (let day = 1; day <= daysInMonth(month); day++) {
      const date = dateKey(month, day);
      if (date < spec.startedOn || date > today) continue;
      if (spec.stopped && date > spec.stopped.on) continue;
      if (!spec.weekdays.includes(weekdayOf(date))) continue;

      const roll = rand(spec.id + date);
      if (HOLIDAYS.has(date)) {
        out.push(entry(spec.id, date, 0, "H"));
      } else if (roll < spec.skipRate * 0.6) {
        out.push(entry(spec.id, date, 0, "S"));
      } else if (roll < spec.skipRate) {
        out.push(entry(spec.id, date, 0, "T"));
      } else {
        const bonus = roll > 0.9 ? 0.5 : 0;
        out.push(entry(spec.id, date, spec.hours + bonus, null));
      }
    }
  }
  return out;
}

function entry(studentId: string, date: string, hours: number, code: Entry["code"]): Entry {
  return {
    id: `e-${studentId}-${date}`,
    studentId,
    date,
    hours,
    code,
    loggedAt: `${date}T21:00:00.000Z`,
  };
}

export function buildSeed(fy: number): DB {
  const months = fiscalMonths(fy);
  const today = todayISO();

  const students: Student[] = SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    tutorId: spec.tutorId,
    site: spec.site,
    days: spec.days,
    times: spec.times,
    startedOn: spec.startedOn,
    goals: Object.fromEntries(
      Object.entries(spec.goals).map(([code, on]) => [code, { attainedOn: on }]),
    ),
    otherGoals: (spec.otherGoals ?? []).map((g, i) => ({ id: `${spec.id}-og${i}`, ...g })),
    stopped: spec.stopped ?? null,
  }));

  return {
    tutors: [
      { id: "t-maria", name: "Maria Okonkwo", email: "maria.o@example.org" },
    ],
    students,
    entries: SPECS.flatMap((spec) => buildEntries(spec, months, today)),
    submissions: [
      { studentId: "s-amina", month: months[0], submittedAt: "2026-08-02T14:02:00.000Z", submittedBy: "t-maria" },
      { studentId: "s-amina", month: months[1], submittedAt: "2026-09-01T09:40:00.000Z", submittedBy: "t-maria" },
      { studentId: "s-luis", month: months[0], submittedAt: "2026-08-03T18:20:00.000Z", submittedBy: "t-maria" },
      { studentId: "s-rosa", month: months[0], submittedAt: "2026-08-04T12:10:00.000Z", submittedBy: "t-maria" },
    ],
  };
}
