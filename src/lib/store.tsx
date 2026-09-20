"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AbsenceCode, DB, Entry, Student } from "./types";
import { buildSeed } from "./seed";
import { fiscalYearOf, monthKey, todayISO } from "./fy";

const STORAGE_KEY = "lvaep.tutorlog.v1";

export const CURRENT_FY = fiscalYearOf(new Date());

export type Identity = { role: "tutor"; tutorId: string } | { role: "staff" };

type Store = {
  db: DB;
  ready: boolean;
  identity: Identity;
  setIdentity: (id: Identity) => void;
  setEntry: (studentId: string, date: string, hours: number, code: AbsenceCode | null) => void;
  clearEntry: (studentId: string, date: string) => void;
  toggleGoal: (studentId: string, code: string) => void;
  addOtherGoal: (studentId: string, label: string) => void;
  toggleOtherGoal: (studentId: string, goalId: string) => void;
  updateStudent: (studentId: string, patch: Partial<Student>) => void;
  addStudent: (input: { name: string; tutorId: string; site: string; days: string; times: string }) => string;
  setStopped: (studentId: string, stopped: Student["stopped"]) => void;
  submitMonth: (studentId: string, month: string) => void;
  unsubmitMonth: (studentId: string, month: string) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => buildSeed(CURRENT_FY));
  const [identity, setIdentityState] = useState<Identity>({ role: "tutor", tutorId: "t-maria" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { db: DB; identity: Identity };
        if (parsed.db) setDb(parsed.db);
        if (parsed.identity) setIdentityState(parsed.identity);
      }
    } catch {
      // A corrupt cache should not block the app; fall back to the seed.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, identity }));
    } catch {
      // Storage full or blocked: the session still works, it just won't persist.
    }
  }, [db, identity, ready]);

  const mutateStudent = useCallback((studentId: string, fn: (s: Student) => Student) => {
    setDb((prev) => ({
      ...prev,
      students: prev.students.map((s) => (s.id === studentId ? fn(s) : s)),
    }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      db,
      ready,
      identity,
      setIdentity: setIdentityState,

      setEntry(studentId, date, hours, code) {
        setDb((prev) => {
          const next: Entry = {
            id: `e-${studentId}-${date}`,
            studentId,
            date,
            hours: code ? 0 : hours,
            code,
            loggedAt: new Date().toISOString(),
          };
          const rest = prev.entries.filter((e) => !(e.studentId === studentId && e.date === date));
          return { ...prev, entries: [...rest, next] };
        });
      },

      clearEntry(studentId, date) {
        setDb((prev) => ({
          ...prev,
          entries: prev.entries.filter((e) => !(e.studentId === studentId && e.date === date)),
        }));
      },

      toggleGoal(studentId, code) {
        mutateStudent(studentId, (s) => {
          const goals = { ...s.goals };
          if (goals[code]) delete goals[code];
          else goals[code] = { attainedOn: todayISO() };
          return { ...s, goals };
        });
      },

      addOtherGoal(studentId, label) {
        mutateStudent(studentId, (s) => ({
          ...s,
          otherGoals: [
            ...s.otherGoals,
            { id: `og-${Date.now().toString(36)}`, label, attainedOn: null },
          ],
        }));
      },

      toggleOtherGoal(studentId, goalId) {
        mutateStudent(studentId, (s) => ({
          ...s,
          otherGoals: s.otherGoals.map((g) =>
            g.id === goalId ? { ...g, attainedOn: g.attainedOn ? null : todayISO() } : g,
          ),
        }));
      },

      updateStudent(studentId, patch) {
        mutateStudent(studentId, (s) => ({ ...s, ...patch }));
      },

      addStudent(input) {
        const id = `s-${Date.now().toString(36)}`;
        setDb((prev) => ({
          ...prev,
          students: [
            ...prev.students,
            {
              id,
              name: input.name,
              tutorId: input.tutorId,
              site: input.site,
              days: input.days,
              times: input.times,
              startedOn: todayISO(),
              goals: {},
              otherGoals: [],
              stopped: null,
            },
          ],
        }));
        return id;
      },

      setStopped(studentId, stopped) {
        mutateStudent(studentId, (s) => ({ ...s, stopped }));
      },

      submitMonth(studentId, month) {
        setDb((prev) => ({
          ...prev,
          submissions: [
            ...prev.submissions.filter((s) => !(s.studentId === studentId && s.month === month)),
            {
              studentId,
              month,
              submittedAt: new Date().toISOString(),
              submittedBy: identity.role === "tutor" ? identity.tutorId : "staff",
            },
          ],
        }));
      },

      unsubmitMonth(studentId, month) {
        setDb((prev) => ({
          ...prev,
          submissions: prev.submissions.filter(
            (s) => !(s.studentId === studentId && s.month === month),
          ),
        }));
      },

      resetDemo() {
        setDb(buildSeed(CURRENT_FY));
      },
    }),
    [db, ready, identity, mutateStudent],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/* ---------- selectors ---------- */

export function entryIndex(entries: Entry[]): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const e of entries) map.set(`${e.studentId}:${e.date}`, e);
  return map;
}

export function hoursInMonth(entries: Entry[], studentId: string, month: string): number {
  return entries.reduce(
    (sum, e) =>
      e.studentId === studentId && monthKey(e.date) === month ? sum + e.hours : sum,
    0,
  );
}

export function sessionsInMonth(entries: Entry[], studentId: string, month: string): number {
  return entries.filter(
    (e) => e.studentId === studentId && monthKey(e.date) === month && e.hours > 0,
  ).length;
}

export function isSubmitted(db: DB, studentId: string, month: string): boolean {
  return db.submissions.some((s) => s.studentId === studentId && s.month === month);
}

export function lastEntryFor(entries: Entry[], studentId: string): Entry | null {
  return (
    entries
      .filter((e) => e.studentId === studentId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1) ?? null
  );
}
