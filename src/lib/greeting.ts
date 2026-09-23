/**
 * The dashboard's greeting: "Good evening, Maria", "Welcome back, Maria"…
 * One is picked per person per day, so it doesn't change on every render but
 * does vary from day to day. The time-of-day greeting is always in the mix
 * and always matches the hour.
 */

const GENERAL = ["Hello", "Hi", "Welcome back", "Greetings", "Good to see you"];

export function timeOfDayGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Maria Okonkwo" → "Maria". Empty or blank names fall back to no name. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Small stable hash, so the same name and day always pick the same greeting. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function greeting(name: string, now: Date = new Date()): string {
  const options = [timeOfDayGreeting(now.getHours()), ...GENERAL];
  const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const pick = options[hash(`${name}|${day}`) % options.length];
  const first = firstName(name);
  return first ? `${pick}, ${first}` : pick;
}
