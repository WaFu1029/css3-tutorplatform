/** LVAEP's fiscal year runs July through June. */

export const FY_MONTHS = [
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
] as const;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The fiscal year a date falls in, named by its starting calendar year. */
export function fiscalYearOf(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
}

export function fiscalYearLabel(fy: number): string {
  return `FY ${fy}–${fy + 1}`;
}

/** The twelve YYYY-MM keys of a fiscal year, in Jul–Jun order. */
export function fiscalMonths(fy: number): string[] {
  return FY_MONTHS.map((_, i) => {
    const year = i < 6 ? fy : fy + 1;
    const month = ((6 + i) % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function dateKey(monthKeyStr: string, day: number): string {
  return `${monthKeyStr}-${String(day).padStart(2, "0")}`;
}

export function monthLabel(key: string, style: "short" | "long" = "long"): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTH_NAMES[m - 1];
  return style === "short" ? `${name.slice(0, 3)} ${String(y).slice(2)}` : `${name} ${y}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
}

export function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}
