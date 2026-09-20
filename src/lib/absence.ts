import type { AbsenceCode } from "./types";

/** One letter per code, and that letter is also the keyboard shortcut in the ledger. */
export const ABSENCE_CODES: AbsenceCode[] = ["T", "S", "H"];

export const ABSENCE_LABEL: Record<AbsenceCode, string> = {
  T: "Tutor absent",
  S: "Student absent",
  H: "Holiday",
};

/** Lower-cased key presses the ledger accepts, mapped to the code they record. */
export const ABSENCE_KEYS: Record<string, AbsenceCode> = { t: "T", s: "S", h: "H" };

/** Codes were two letters (TA/SA) before the single-letter convention. */
const LEGACY: Record<string, AbsenceCode> = { TA: "T", SA: "S", H: "H" };

export function normalizeCode(code: string | null | undefined): AbsenceCode | null {
  if (!code) return null;
  return LEGACY[code] ?? null;
}
