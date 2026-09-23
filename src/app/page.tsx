"use client";

import Link from "next/link";
import { ArrowRightIcon, UsersIcon } from "lucide-react";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalMonths, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { expectsReport, hoursInMonth, isMonthSent } from "@/lib/logic";
import { greeting } from "@/lib/greeting";
import { visibleStudents } from "@/lib/permissions";
import { RequirePermission } from "@/components/RequirePermission";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { ScheduleBoard } from "./_components/ScheduleBoard";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function TutoringLogPage() {
  return (
    <RequirePermission permission="log:view">
      <TutoringLog />
    </RequirePermission>
  );
}

function TutoringLog() {
  const { db, identity } = useStore();
  const today = todayISO();
  const current = monthKey(today);

  const students = visibleStudents(db, identity);

  const monthHours = students.reduce((sum, s) => sum + hoursInMonth(db.entries, s.id, current), 0);

  // Sheets owed this fiscal year so far, oldest month first.
  const unsent = fiscalMonths(CURRENT_FY)
    .filter((m) => m <= current)
    .map((month) => ({
      month,
      count: students.filter((s) => expectsReport(s, month) && !isMonthSent(db.reports, s.id, month))
        .length,
    }))
    .filter((x) => x.count > 0);

  const name =
    identity.role === "tutor"
      ? (db.tutors.find((t) => t.id === identity.tutorId)?.name ?? "")
      : "";

  return (
    <div className="mx-auto max-w-[1560px] px-5 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">{greeting(name)}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {students.length} student{students.length === 1 ? "" : "s"} ·{" "}
            {formatHours(monthHours)} hours in {monthLabel(current)}
          </p>
        </div>
        {unsent.length > 0 && (
          <ul className="flex flex-col items-end gap-1 text-sm">
            {unsent.map(({ month, count }) => (
              <li key={month}>
                <Link
                  href="/reports"
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-secondary-foreground hover:bg-secondary/80"
                >
                  {count} sheet{count === 1 ? "" : "s"} still to confirm for{" "}
                  {monthLabel(month).split(" ")[0]}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {students.length === 0 ? (
        <Empty className="rounded-xl bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No students assigned yet</EmptyTitle>
            <EmptyDescription>
              The office assigns students to tutors. Once you have one, your sessions go here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddStudentDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6">
          <ScheduleBoard students={students} months={fiscalMonths(CURRENT_FY)} />
        </div>
      )}
    </div>
  );
}
