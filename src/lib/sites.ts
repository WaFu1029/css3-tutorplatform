/**
 * LVAEP's two tutoring sites, with the hours each is open for tutoring.
 * Every site name in the app (student records, pickers, the year sheet's
 * contact block) comes from here.
 */

import type { ScheduleSlot } from "./types";
import { formatTime, WEEKDAY_SHORT } from "./schedule";

export type Site = {
  name: string;
  address: string;
  phone: string;
  /** When the site is open for tutoring. Weekday follows Date#getDay. */
  open: { weekdays: number[]; startTime: string; endTime: string };
  /** The open hours as the site publishes them. */
  hoursLabel: string;
};

export const SITES: Site[] = [
  {
    name: "Bloomfield Public Library",
    address: "90 Broad Street, 2nd Floor, Bloomfield, NJ 07003",
    phone: "(973) 566-6200, ext. 217 or 225",
    open: { weekdays: [1, 2, 3, 4], startTime: "10:00", endTime: "15:00" },
    hoursLabel: "Mondays through Thursdays 10 am to 3 pm",
  },
  {
    name: "Passaic Public Library",
    address: "195 Gregory Avenue, 2nd Floor, Passaic, NJ 07055",
    phone: "(973) 470-0039",
    open: { weekdays: [2], startTime: "10:00", endTime: "12:00" },
    hoursLabel: "Tuesdays 10 am to 12 pm",
  },
];

export const DEFAULT_SITE = SITES[0].name;

export function siteNamed(name: string): Site | undefined {
  return SITES.find((s) => s.name === name);
}

/** Whether a weekly slot falls inside the site's open hours. Unknown sites pass. */
export function withinSiteHours(siteName: string, slot: ScheduleSlot): boolean {
  const site = siteNamed(siteName);
  if (!site) return true;
  const { weekdays, startTime, endTime } = site.open;
  return (
    weekdays.includes(slot.weekday) && slot.startTime >= startTime && slot.endTime <= endTime
  );
}

/** "Open Tue 10:00 am–12:00 pm" style summary for hints. */
export function openHoursShort(site: Site): string {
  const days = site.open.weekdays.map((d) => WEEKDAY_SHORT[d]);
  const span = days.length > 2 ? `${days[0]}–${days.at(-1)}` : days.join(" & ");
  return `${span} ${formatTime(site.open.startTime)}–${formatTime(site.open.endTime)}`;
}
