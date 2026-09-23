"use client";

import { useEffect, useState } from "react";
import type { Student } from "@/lib/types";
import { monthKey, todayISO } from "@/lib/fy";
import { StudentsCalendar, type Selection } from "./StudentsCalendar";
import { SessionPanel } from "./SessionPanel";

/** The dashboard's calendar with the session panel beside it, 3:1. */
export function ScheduleBoard({ students, months }: { students: Student[]; months: string[] }) {
  const today = todayISO();
  // Null once the tutor clicks off the calendar; the panel then shows today.
  const [selected, setSelected] = useState<Selection | null>({ date: today, studentId: null });
  const [month, setMonth] = useState(() =>
    months.includes(monthKey(today)) ? monthKey(today) : months[0],
  );

  function select(next: Selection) {
    setSelected(next);
    // "Back to today" from another month brings the calendar along.
    if (months.includes(monthKey(next.date))) setMonth(monthKey(next.date));
  }

  // Clicking anywhere but a day or the session panel lets go of the picked day.
  // The overwrite dialog and toasts render outside both, so they're exempt.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (
        !target ||
        target.closest('[data-day], [data-session-panel], [role="alertdialog"], [data-sonner-toaster]')
      )
        return;
      setSelected(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
      <StudentsCalendar
        students={students}
        months={months}
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={select}
      />
      <div data-session-panel className="lg:sticky lg:top-[68px] lg:self-start">
        <SessionPanel
          students={students}
          selected={selected ?? { date: today, studentId: null }}
          onSelect={select}
        />
      </div>
    </div>
  );
}
