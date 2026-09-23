import type { AbsenceCode } from "./types";

export const ABSENCE_CODES: AbsenceCode[] = ["TA", "SA", "H"];

export const ABSENCE_LABEL: Record<AbsenceCode, string> = {
  TA: "Tutor absent",
  SA: "Student absent",
  H: "Holiday",
};

/** Lower-cased key presses the ledger accepts, mapped to the code they record. */
export const ABSENCE_KEYS: Record<string, AbsenceCode> = { t: "TA", s: "SA", h: "H" };

/** Caches from the single-letter period hold T/S; the paper form and contract use TA/SA. */
const LEGACY: Record<string, AbsenceCode> = { T: "TA", S: "SA", TA: "TA", SA: "SA", H: "H" };

export function normalizeCode(code: string | null | undefined): AbsenceCode | null {
  if (!code) return null;
  return LEGACY[code] ?? null;
}
