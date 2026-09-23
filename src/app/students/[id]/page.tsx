"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalMonths, monthKey, todayISO } from "@/lib/fy";
import { entryIndex, isMonthSent, monthSummary, reportFor } from "@/lib/logic";
import { can, visibleStudents } from "@/lib/permissions";
import { LoggingBar } from "@/components/LoggingBar";
import { GoalsColumn } from "@/components/GoalsColumn";
import { StudentSidebar } from "@/components/StudentSidebar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StudentHeader } from "./_components/StudentHeader";
import { MonthCalendar } from "./_components/MonthCalendar";
import { MonthSummary } from "./_components/MonthSummary";
import { FiscalYearStrip, type MonthState } from "./_components/FiscalYearStrip";

/**
 * One student's corner of the tutoring log. Staff never reach it: RouteGuard
 * (lib/permissions ROUTE_RULES) sends them to Monthly reports, and a tutor
 * opening another tutor's student gets the not-found state below.
 *
 * `?month=YYYY-MM` opens the calendar on that month; Monthly reports links
 * a student's gaps here that way.
 */
export default function StudentPage() {
  return (
    <Suspense>
      <StudentView />
    </Suspense>
  );
}

function StudentView() {
  const { id } = useParams<{ id: string }>();
  const { db, identity, ready, saveEntries, clearEntry } = useStore();
  const months = useMemo(() => fiscalMonths(CURRENT_FY), []);
  const thisMonth = monthKey(todayISO());

  const asked = useSearchParams().get("month");
  const fallback = months.includes(thisMonth) ? thisMonth : months[0];
  const [month, setMonth] = useState(asked && months.includes(asked) ? asked : fallback);
  // A new ?month on the same page (another link from reports) moves the calendar.
  const [lastAsked, setLastAsked] = useState(asked);
  if (asked !== lastAsked) {
    setLastAsked(asked);
    if (asked && months.includes(asked)) setMonth(asked);
  }

  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const student = students.find((s) => s.id === id);
  const index = useMemo(() => entryIndex(db.entries), [db.entries]);

  const states = useMemo<MonthState[]>(() => {
    if (!student) return [];
    return months.map((m) => {
      const s = monthSummary(student, m, db.entries);
      if (isMonthSent(db.reports, student.id, m)) return { kind: "sent", hours: s.hours };
      const before = student.startedOn ? m < monthKey(student.startedOn) : false;
      if (m > thisMonth || (before && s.hours === 0)) return { kind: "not-started" };
      return { kind: "open", hours: s.hours, gaps: s.gaps.length };
    });
  }, [student, months, db.entries, db.reports, thisMonth]);

  // Until the saved session loads, the seed is showing and a student added
  // in an earlier visit would look missing.
  if (!ready) return null;

  if (!student) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <Empty className="rounded-xl bg-card">
          <EmptyHeader>
            <EmptyTitle>This student isn&apos;t on your list</EmptyTitle>
            <EmptyDescription>
              They may belong to another tutor, or the link is out of date.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
              Back to the tutoring log
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const summary = monthSummary(student, month, db.entries);
  const report = reportFor(db.reports, student.id, month);

  return (
    <div className="mx-auto max-w-[1560px] px-5 py-6">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[68px] lg:self-start">
          <StudentSidebar students={students} activeId={student.id} showStatus />
        </aside>

        <div className="min-w-0 space-y-6">
          <StudentHeader student={student} editable={can(identity, "students:manage")} />

          {/* Keyed so switching students re-seeds the bar's own selection. */}
          <LoggingBar key={student.id} students={students} preselectedStudentId={student.id} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            <GoalsColumn students={[student]} className="order-2 lg:order-1" />

            <section
              id={`month-${month}`}
              aria-label="Attendance"
              className="order-1 min-w-0 scroll-mt-20 space-y-4 lg:order-2"
            >
              <FiscalYearStrip months={months} states={states} active={month} onPick={setMonth} />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <MonthCalendar
                  key={student.id}
                  student={student}
                  months={months}
                  month={month}
                  onMonthChange={setMonth}
                  index={index}
                  gaps={summary.gaps}
                  sent={report?.status === "sent"}
                  onSet={(date, value) => saveEntries([student.id], date, value)}
                  onClear={(date) => clearEntry(student.id, date)}
                />
                <MonthSummary
                  student={student}
                  month={month}
                  summary={summary}
                  report={report}
                  entries={db.entries}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
