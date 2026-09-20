/**
 * Who may see and do what.
 *
 * This is the one place roles are defined. Pages ask `can()` rather than
 * testing `identity.role` themselves, so adding a role means editing this file
 * and nothing else.
 *
 * Scope note: these checks shape the UI. They are not a security boundary —
 * the store runs in the browser and the header lets anyone switch identity.
 * Enforcement that holds has to live in row level security on the Supabase
 * tables, which is switched on with no policies written yet.
 */

import type { DB, Student } from "./types";

export type Identity = { role: "tutor"; tutorId: string } | { role: "staff" };

export type Permission =
  /** Open the day-to-day tutoring log and record sessions. */
  | "log:view"
  /** Read the monthly reports page. */
  | "reports:view"
  /** See every tutor's students there, not just one's own. */
  | "reports:viewAll"
  /** Add students and edit their details. */
  | "students:manage";

const ROLE_PERMISSIONS: Record<Identity["role"], Permission[]> = {
  // Tutors work the log and report on the students assigned to them.
  tutor: ["log:view", "reports:view", "students:manage"],
  // The office reads reports across every tutor. No tutoring log for now:
  // staff do not hold students of their own.
  staff: ["reports:view", "reports:viewAll"],
};

export function can(identity: Identity, permission: Permission): boolean {
  return ROLE_PERMISSIONS[identity.role].includes(permission);
}

/** The students this identity is allowed to see at all. */
export function visibleStudents(db: DB, identity: Identity): Student[] {
  if (can(identity, "reports:viewAll")) return db.students;
  return db.students.filter(
    (s) => identity.role === "tutor" && s.tutorId === identity.tutorId,
  );
}

export const NAV = [
  { href: "/", label: "Tutoring log", permission: "log:view" },
  { href: "/reports", label: "Monthly reports", permission: "reports:view" },
] as const satisfies readonly { href: string; label: string; permission: Permission }[];

export function navFor(identity: Identity) {
  return NAV.filter((item) => can(identity, item.permission));
}

/** Where a role lands when it opens the app, or is turned away from a page. */
export function landingFor(identity: Identity): string {
  return navFor(identity)[0]?.href ?? "/reports";
}
