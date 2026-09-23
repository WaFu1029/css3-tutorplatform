import { describe, expect, it } from "vitest";
import { formatDays, formatSchedule, formatTimes } from "./schedule";

const tueThu = [
  { weekday: 4, startTime: "18:00", endTime: "19:30" },
  { weekday: 2, startTime: "18:00", endTime: "19:30" },
];

describe("formatDays / formatTimes", () => {
  it("fills the paper form's blanks in weekday order", () => {
    expect(formatDays(tueThu)).toBe("Tue & Thu");
    expect(formatTimes(tueThu)).toBe("6:00–7:30 pm");
  });

  it("lists each distinct time once", () => {
    const mixed = [
      { weekday: 1, startTime: "10:00", endTime: "11:00" },
      { weekday: 3, startTime: "18:00", endTime: "19:00" },
    ];
    expect(formatTimes(mixed)).toBe("10:00–11:00 am; 6:00–7:00 pm");
  });

  it("says Walk-in when there is no schedule", () => {
    expect(formatDays([])).toBe("Walk-in");
    expect(formatTimes([])).toBe("Walk-in");
    expect(formatSchedule([])).toBe("Walk-in");
  });
});
