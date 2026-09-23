"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DB, Goal, ScheduleSlot, SessionEntry, Student } from "./types";
import type { GoalStage } from "./goals";
import { buildSeed } from "./seed";
import { normalizeCode } from "./absence";
import { fiscalYearOf, todayISO } from "./fy";
import * as m from "./mutations";
import { isLegacy, migrateLegacy, upgradeV4, type V4DB } from "./migrate";
import type { Identity } from "./permissions";

const STORAGE_KEY = "lvaep.tutorlog.v7";
/**
 * v4 had undated schedules and plain group member lists (`upgradeV4`); v3
 * also lacked groups and dismissals (`withDefaults`).
 */
const PREVIOUS_KEYS = ["lvaep.tutorlog.v4", "lvaep.tutorlog.v3"];
/** Caches from before the shared contract, newest first. */
const LEGACY_KEYS = ["lvaep.tutorlog.v2", "lvaep.tutorlog.v1"];

export const CURRENT_FY = fiscalYearOf(new Date());

// Defined with the permission rules that read it.
export type { Identity };
export type { EntryValue, SaveLine } from "./mutations";

export type SaveResult = Omit<m.SaveResult, "db">;

type Store = {
  db: DB;
  ready: boolean;
  identity: Identity;
  setIdentity: (id: Identity) => void;

  /** Same value for every student; two or more share a groupId. Sent months are skipped. */
  saveEntries: (studentIds: string[], date: string, value: m.EntryValue) => SaveResult;
  /** One line per student, each with its own value, saved as one session. */
  saveSession: (date: string, lines: m.SaveLine[]) => SaveResult;
  clearEntry: (studentId: string, date: string) => void;
  /** The tutor's note on a logged day; empty removes it. Capped at 50 words. */
  setEntryNote: (studentId: string, date: string, note: string) => void;
  /** A session's own time and place, logged or not; blank fields fall back to the schedule. */
  setSessionDetails: (studentId: string, date: string, input: m.WhenWhereInput) => void;

  /** "Nothing to record for this day": the day stops counting as unlogged. */
  dismissDay: (studentId: string, date: string) => void;
  undismissDay: (studentId: string, date: string) => void;

  addGoal: (studentId: string, goal: { catalogKey: string } | { customLabel: string }) => string;
  /** Stamps today's date when attained, clears it when not. */
  setGoalAttained: (goalId: string, attained: boolean) => void;
  /** Moves a goal between not started, in progress and attained. */
  /** Stamps `on` (default today) as the start or attained date where one is set. */
  setGoalStage: (goalId: string, stage: GoalStage, on?: string) => void;
  removeGoal: (goalId: string) => void;
  /** Undo: puts back this exact goal record (after a removal or a stage change). */
  restoreGoal: (goal: Goal) => void;

  /** Empty `slots` for a walk-in. */
  addStudent: (input: Pick<Student, "name" | "tutorId" | "site"> & { slots: ScheduleSlot[] }) => string;
  /** Not for schedules: use setStudentSchedule, which keeps past dates on the old schedule. */
  updateStudent: (studentId: string, patch: Partial<Omit<Student, "id" | "schedule">>) => void;
  /** The new slots apply from today on; earlier dates keep the schedule they had. */
  setStudentSchedule: (studentId: string, slots: ScheduleSlot[]) => void;
  stopStudent: (studentId: string, reason: string, date?: string) => void;
  resumeStudent: (studentId: string) => void;

  /** Starts today: members join today and its schedule applies from today. */
  addGroup: (input: { tutorId: string } & m.GroupInput) => string;
  /** Changes take effect today; members added join today, members removed leave today. */
  updateGroup: (groupId: string, patch: Partial<m.GroupInput>) => void;
  /** Hides the group from today. Past scheduled days and logged entries are untouched. */
  removeGroup: (groupId: string) => void;

  /** Always sends. Review unlogged days before calling it, not instead of it. */
  sendMonth: (studentId: string, month: string) => void;
  reopenMonth: (studentId: string, month: string) => void;

  resetDemo: () => void;
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeCodes(entries: SessionEntry[]): SessionEntry[] {
  return entries.flatMap((e): SessionEntry[] => {
    if (e.code === undefined) return [e];
    const code = normalizeCode(e.code);
    return code ? [{ ...e, code }] : [];
  });
}

/** Reads whatever cache this browser has, in the current shape. */
function loadCache(): { db?: DB; identity?: Identity } | null {
  // v5 held demo data at sites LVAEP doesn't use and at hours they're closed;
  // v6 lacked FY 2025–26. It's demo data, so it's replaced with the current
  // seed, not carried over.
  const reseed = ["lvaep.tutorlog.v6", "lvaep.tutorlog.v5"];
  if (
    !window.localStorage.getItem(STORAGE_KEY) &&
    reseed.some((key) => window.localStorage.getItem(key))
  ) {
    return null;
  }
  for (const key of [STORAGE_KEY, ...PREVIOUS_KEYS]) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw) as { db?: DB; identity?: Identity };
    if (!parsed.db) return { identity: parsed.identity };
    let db = m.withDefaults(parsed.db);
    if (key !== STORAGE_KEY) db = upgradeV4(db as unknown as V4DB, todayISO());
    // A tutor added to the demo seed since this cache was written joins it.
    db = m.addMissingTutors(db, buildSeed(CURRENT_FY));
    return { db: { ...db, entries: normalizeCodes(db.entries) }, identity: parsed.identity };
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

  const value = useMemo<Store>(() => {
    const update = (fn: (prev: DB) => DB) => setDb(fn);
    const patchStudent = (studentId: string, fn: (s: Student) => Student) =>
      update((prev) => m.updateStudent(prev, studentId, fn));

    function saveSession(date: string, lines: m.SaveLine[]): SaveResult {
      // Worked out against the current DB for the return value, then applied
      // to the latest state so quick successive saves don't clobber each other.
      const opts = { newId, now: new Date().toISOString() };
      const { saved, locked } = m.saveSession(db, date, lines, opts);
      if (saved.length) update((prev) => m.saveSession(prev, date, lines, opts).db);
      return { saved, locked };
    }

    return {
      db,
      ready,
      identity,
      setIdentity: setIdentityState,

      saveSession,
      saveEntries: (studentIds, date, entryValue) =>
        saveSession(date, studentIds.map((studentId) => ({ studentId, value: entryValue }))),
      clearEntry: (studentId, date) => update((prev) => m.clearEntry(prev, studentId, date)),
      setEntryNote: (studentId, date, note) =>
        update((prev) => m.setEntryNote(prev, studentId, date, note)),
      setSessionDetails: (studentId, date, input) =>
        update((prev) => m.setSessionDetails(prev, studentId, date, input)),

      dismissDay: (studentId, date) => update((prev) => m.dismissDay(prev, studentId, date)),
      undismissDay: (studentId, date) => update((prev) => m.undismissDay(prev, studentId, date)),

      addGoal(studentId, goal) {
        const id = newId("g");
        update((prev) => m.addGoal(prev, { id, studentId, addedDate: todayISO(), ...goal }));
        return id;
      },
      setGoalAttained: (goalId, attained) =>
        update((prev) => m.setGoalAttained(prev, goalId, attained ? todayISO() : null)),
      setGoalStage: (goalId, stage, on = todayISO()) =>
        update((prev) => m.setGoalStage(prev, goalId, stage, on)),
      removeGoal: (goalId) => update((prev) => m.removeGoal(prev, goalId)),
      restoreGoal: (goal) => update((prev) => m.restoreGoal(prev, goal)),

      addStudent({ slots, ...input }) {
        const id = newId("s");
        const today = todayISO();
        update((prev) => ({
          ...prev,
          students: [
            ...prev.students,
            {
              id,
              ...input,
              schedule: slots.length ? [{ from: today, slots }] : [],
              status: "active",
              startedOn: today,
            },
          ],
        }));
        return id;
      },
      setStudentSchedule: (studentId, slots) =>
        update((prev) => m.setStudentSchedule(prev, studentId, slots, todayISO())),
      updateStudent: (studentId, patch) => patchStudent(studentId, (s) => ({ ...s, ...patch })),
      stopStudent: (studentId, reason, date = todayISO()) =>
        patchStudent(studentId, (s) => ({
          ...s,
          status: "stopped",
          stoppedDate: date,
          stoppedReason: reason,
        })),
      resumeStudent: (studentId) =>
        patchStudent(studentId, (s) => {
          const next: Student = { ...s, status: "active" };
          delete next.stoppedDate;
          delete next.stoppedReason;
          return next;
        }),

      addGroup(input) {
        const id = newId("grp");
        update((prev) =>
          m.applySharedGoals(m.addGroup(prev, { id, ...input }, todayISO()), id, todayISO(), newId),
        );
        return id;
      },
      // Shared goals reach new members too, since this runs after membership changes.
      updateGroup: (groupId, patch) =>
        update((prev) =>
          m.applySharedGoals(m.updateGroup(prev, groupId, patch, todayISO()), groupId, todayISO(), newId),
        ),
      removeGroup: (groupId) => update((prev) => m.removeGroup(prev, groupId, todayISO())),

      sendMonth: (studentId, month) =>
        update((prev) => m.sendMonth(prev, studentId, month, new Date().toISOString())),
      reopenMonth: (studentId, month) => update((prev) => m.reopenMonth(prev, studentId, month)),

      resetDemo: () => setDb(buildSeed(CURRENT_FY)),
    };
  }, [db, ready, identity]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
