"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalMonths, monthKey, todayISO } from "@/lib/fy";
import { entryIndex, ledgerOf, monthStatus, monthSummary, reportFor } from "@/lib/logic";
import { can, visibleStudents } from "@/lib/permissions";
import { GoalsColumn } from "@/components/GoalsColumn";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StudentHeader } from "./_components/StudentHeader";
import { StudentSwitcher } from "./_components/StudentSwitcher";
import { MonthCalendar } from "./_components/MonthCalendar";
import { MonthSummary } from "./_components/MonthSummary";

/**
 * One student's corner of the tutoring log. Staff never reach it: RouteGuard
 * (lib/permissions ROUTE_RULES) sends them to Monthly reports, and a tutor
 * opening another tutor's student gets the not-found state below.
 *
 * `?month=YYYY-MM` opens the calendar on that month; Monthly reports links
 * a student's unlogged days here that way.
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
  const { db, identity, ready, saveEntries, clearEntry, dismissDay, undismissDay } = useStore();
  const months = useMemo(() => fiscalMonths(CURRENT_FY), []);
  const thisMonth = monthKey(todayISO());

  const asked = useSearchParams().get("month");
  const fallback = months.includes(thisMonth) ? thisMonth : months[0];
  const [month, setMonth] = useState(asked && months.includes(asked) ? asked : fallback);
  // The side panel the calendar renders the picked day into; set once it mounts.
  const [dayPanel, setDayPanel] = useState<HTMLDivElement | null>(null);
  // A new ?month on the same page (another link from reports) moves the calendar.
  const [lastAsked, setLastAsked] = useState(asked);
  if (asked !== lastAsked) {
    setLastAsked(asked);
    if (asked && months.includes(asked)) setMonth(asked);
  }

  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const student = students.find((s) => s.id === id);
  const index = useMemo(() => entryIndex(db.entries), [db.entries]);

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
            <Button variant="outline" nativeButton={false} render={<Link href="/students" />}>
              Back to your students
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const summary = monthSummary(student, month, ledgerOf(db));
  const dismissed = new Set(
    db.dismissals.filter((d) => d.studentId === student.id).map((d) => d.date),
  );
  const report = reportFor(db.reports, student.id, month);

  return (
    <div className="mx-auto max-w-[1560px] px-5 py-6">
      <div className="space-y-6">
        <div className="min-w-0 space-y-6">
          <StudentHeader
            student={student}
            editable={can(identity, "students:manage")}
            stepper={<StudentSwitcher students={students} activeId={student.id} />}
          />

          <GoalsColumn students={[student]} className="rounded-xl bg-card p-5" />

          <section
            id={`month-${month}`}
            aria-label="Attendance"
            className="min-w-0 scroll-mt-20 space-y-4"
          >
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <MonthCalendar
                key={student.id}
                student={student}
                months={months}
                month={month}
                onMonthChange={setMonth}
                index={index}
                groups={db.groups}
                unlogged={summary.unlogged}
                dismissed={dismissed}
                sent={report?.status === "sent"}
                onSet={(date, value) => saveEntries([student.id], date, value)}
                onClear={(date) => clearEntry(student.id, date)}
                onDismiss={(date, undo) =>
                  undo ? undismissDay(student.id, date) : dismissDay(student.id, date)
                }
                editorTarget={dayPanel}
                summary={
                  <MonthSummary
                    compact
                    student={student}
                    month={month}
                    summary={summary}
                    report={report}
                    status={monthStatus(student, month, db.reports)}
                  />
                }
              />
              {/* The calendar renders the picked day's editor in here. */}
              <div ref={setDayPanel} data-day-editor className="min-h-[240px] rounded-xl bg-card p-5" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
