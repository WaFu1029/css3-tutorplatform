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
import type { AbsenceCode, DB, Goal, GoalCategory, SessionEntry, Student } from "./types";
import { buildSeed } from "./seed";
import { normalizeCode } from "./absence";
import { categoryOf } from "./goals";
import { fiscalYearOf, monthKey, todayISO } from "./fy";
import { canSend, isMonthSent, makeEntry } from "./logic";
import { isLegacy, migrateLegacy } from "./migrate";
import type { Identity } from "./permissions";

const STORAGE_KEY = "lvaep.tutorlog.v3";
/** Caches from before the shared contract, newest first. */
const LEGACY_KEYS = ["lvaep.tutorlog.v2", "lvaep.tutorlog.v1"];

export const CURRENT_FY = fiscalYearOf(new Date());

// Defined with the permission rules that read it.
export type { Identity };

export type EntryValue = { hours: number } | { code: AbsenceCode };

export type SaveResult = {
  /** Students whose entry was written. */
  saved: string[];
  /** Students skipped because that month is already sent. */
  locked: string[];
};

type Store = {
  db: DB;
  ready: boolean;
  identity: Identity;
  setIdentity: (id: Identity) => void;

  /**
   * Writes one entry per student for the date, replacing any entry already
   * there. Several students share a groupId. Months already sent are skipped.
   */
  saveEntries: (studentIds: string[], date: string, value: EntryValue) => SaveResult;
  clearEntry: (studentId: string, date: string) => void;

  addGoal: (
    studentId: string,
    goal: { catalogKey: string } | { customLabel: string },
  ) => string;
  /** Stamps today's date when attained, clears it when not. */
  setGoalAttained: (goalId: string, attained: boolean) => void;
  removeGoal: (goalId: string) => void;

  addStudent: (input: Pick<Student, "name" | "tutorId" | "site" | "schedule">) => string;
  updateStudent: (studentId: string, patch: Partial<Omit<Student, "id">>) => void;
  stopStudent: (studentId: string, reason: string, date?: string) => void;
  resumeStudent: (studentId: string) => void;

  /** Sends the month to the office. Refuses (returns false) while it has gaps. */
  sendMonth: (studentId: string, month: string) => boolean;
  reopenMonth: (studentId: string, month: string) => void;
  /** @deprecated Use sendMonth. */
  submitMonth: (studentId: string, month: string) => boolean;
  /** @deprecated Use reopenMonth. */
  unsubmitMonth: (studentId: string, month: string) => void;

  resetDemo: () => void;
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Reads whatever cache this browser has, in the current shape. */
function loadCache(): { db?: DB; identity?: Identity } | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as { db?: DB; identity?: Identity };
    if (parsed.db) {
      // Codes are normalised on every load so a stray legacy value can't slip in.
      parsed.db.entries = parsed.db.entries.flatMap((e): SessionEntry[] => {
        if (e.code === undefined) return [e];
        const code = normalizeCode(e.code);
        return code ? [{ ...e, code }] : [];
      });
    }
    return parsed;
  }
  for (const key of LEGACY_KEYS) {
    const old = window.localStorage.getItem(key);
    if (!old) continue;
    const parsed = JSON.parse(old) as { db?: unknown; identity?: Identity };
    return {
      db: isLegacy(parsed.db) ? migrateLegacy(parsed.db) : undefined,
      identity: parsed.identity,
    };
  }
  return null;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => buildSeed(CURRENT_FY));
  const [identity, setIdentityState] = useState<Identity>({ role: "tutor", tutorId: "t-maria" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const cached = loadCache();
      if (cached?.db) setDb(cached.db);
      const tutors = cached?.db?.tutors ?? [];
      const who = cached?.identity;
      // An identity pointing at a tutor who's gone falls back to the default.
      if (who && (who.role === "staff" || tutors.some((t) => t.id === who.tutorId))) {
        setIdentityState(who);
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

  const setReport = useCallback((studentId: string, month: string, status: "open" | "sent") => {
    setDb((prev) => ({
      ...prev,
      reports: [
        ...prev.reports.filter((r) => !(r.studentId === studentId && r.month === month)),
        status === "sent"
          ? { studentId, month, status, sentAt: new Date().toISOString() }
          : { studentId, month, status },
      ],
    }));
  }, []);

  const value = useMemo<Store>(() => {
    const store: Omit<Store, "submitMonth" | "unsubmitMonth"> = {
      db,
      ready,
      identity,
      setIdentity: setIdentityState,

      saveEntries(studentIds, date, entryValue) {
        const month = monthKey(date);
        const locked = studentIds.filter((id) => isMonthSent(db.reports, id, month));
        const saved = studentIds.filter((id) => !locked.includes(id));
        if (saved.length === 0) return { saved, locked };

        const groupId = saved.length > 1 ? newId("grp") : undefined;
        const loggedAt = new Date().toISOString();
        setDb((prev) => {
          const existing = new Map(
            prev.entries.filter((e) => e.date === date).map((e) => [e.studentId, e]),
          );
          const written = saved.map((studentId) => {
            const before = existing.get(studentId);
            return makeEntry(
              {
                // Editing keeps the entry's identity rather than minting a duplicate.
                id: before?.id ?? newId("e"),
                studentId,
                date,
                // Re-saving one student alone leaves them in the group they were logged with.
                groupId: groupId ?? before?.groupId,
                loggedAt,
              },
              entryValue,
            );
          });
          return {
            ...prev,
            entries: [
              ...prev.entries.filter((e) => !(e.date === date && saved.includes(e.studentId))),
              ...written,
            ],
          };
        });
        return { saved, locked };
      },

      clearEntry(studentId, date) {
        setDb((prev) => ({
          ...prev,
          entries: prev.entries.filter((e) => !(e.studentId === studentId && e.date === date)),
        }));
      },

      addGoal(studentId, goal) {
        const id = newId("g");
        const category: GoalCategory = "catalogKey" in goal ? categoryOf(goal.catalogKey) : "other";
        const next: Goal =
          "catalogKey" in goal
            ? { id, studentId, category, addedDate: todayISO(), catalogKey: goal.catalogKey }
            : { id, studentId, category, addedDate: todayISO(), customLabel: goal.customLabel };
        setDb((prev) => ({ ...prev, goals: [...prev.goals, next] }));
        return id;
      },

      setGoalAttained(goalId, attained) {
        setDb((prev) => ({
          ...prev,
          goals: prev.goals.map((g) => {
            if (g.id !== goalId) return g;
            const next: Goal = { ...g, attainedDate: todayISO() };
            if (!attained) delete next.attainedDate;
            return next;
          }),
        }));
      },

      removeGoal(goalId) {
        setDb((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== goalId) }));
      },

      addStudent(input) {
        const id = newId("s");
        setDb((prev) => ({
          ...prev,
          students: [
            ...prev.students,
            { id, ...input, status: "active", startedOn: todayISO() },
          ],
        }));
        return id;
      },

      updateStudent(studentId, patch) {
        mutateStudent(studentId, (s) => ({ ...s, ...patch }));
      },

      stopStudent(studentId, reason, date = todayISO()) {
        mutateStudent(studentId, (s) => ({
          ...s,
          status: "stopped",
          stoppedDate: date,
          stoppedReason: reason,
        }));
      },

      resumeStudent(studentId) {
        mutateStudent(studentId, (s) => {
          const next: Student = { ...s, status: "active" };
          delete next.stoppedDate;
          delete next.stoppedReason;
          return next;
        });
      },

      sendMonth(studentId, month) {
        const student = db.students.find((s) => s.id === studentId);
        if (!student || !canSend(student, month, db.entries)) return false;
        setReport(studentId, month, "sent");
        return true;
      },

      reopenMonth(studentId, month) {
        setReport(studentId, month, "open");
      },

      resetDemo() {
        setDb(buildSeed(CURRENT_FY));
      },
    };
    return { ...store, submitMonth: store.sendMonth, unsubmitMonth: store.reopenMonth };
  }, [db, ready, identity, mutateStudent, setReport]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/* ---------- selectors ---------- */

// The pure helpers live in ./logic; these re-exports keep existing imports working.
export {
  entryIndex,
  hoursInMonth,
  isMonthSent,
  lastSession,
  sessionsInMonth,
} from "./logic";
