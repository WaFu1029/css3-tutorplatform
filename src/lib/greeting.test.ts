import { describe, expect, it } from "vitest";
import { firstName, greeting, timeOfDayGreeting } from "./greeting";

describe("greeting", () => {
  it("uses the first name only", () => {
    expect(firstName("Maria Okonkwo")).toBe("Maria");
    expect(greeting("Maria Okonkwo", new Date(2026, 8, 22, 19))).toMatch(/, Maria$/);
  });

  it("matches the time of day", () => {
    expect(timeOfDayGreeting(8)).toBe("Good morning");
    expect(timeOfDayGreeting(13)).toBe("Good afternoon");
    expect(timeOfDayGreeting(21)).toBe("Good evening");
    expect(timeOfDayGreeting(2)).toBe("Good evening");
  });

  it("never offers the wrong time of day", () => {
    for (let d = 1; d <= 60; d++) {
      const text = greeting("Maria Okonkwo", new Date(2026, 8, d, 9));
      expect(text).not.toMatch(/Good (afternoon|evening)/);
    }
  });

  it("holds steady through a day and varies across days", () => {
    const morning = greeting("Joan Petrosyan", new Date(2026, 8, 22, 10));
    expect(greeting("Joan Petrosyan", new Date(2026, 8, 22, 10, 45))).toBe(morning);
    const month = new Set(
      Array.from({ length: 30 }, (_, i) => greeting("Joan Petrosyan", new Date(2026, 8, i + 1, 10))),
    );
    expect(month.size).toBeGreaterThan(2);
  });

  it("works with any name, and with none", () => {
    expect(greeting("Héctor", new Date(2026, 8, 22, 10))).toMatch(/, Héctor$/);
    expect(greeting("  ", new Date(2026, 8, 22, 10))).not.toContain(",");
  });
});
