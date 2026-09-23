"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightIcon, UsersIcon } from "lucide-react";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalMonths, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { expectsReport, hoursInMonth, isMonthSent } from "@/lib/logic";
import { visibleStudents } from "@/lib/permissions";
import { RequirePermission } from "@/components/RequirePermission";
import { LoggingBar } from "@/components/LoggingBar";
import { GoalsColumn } from "@/components/GoalsColumn";
import { StudentSidebar } from "@/components/StudentSidebar";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { TodayCard } from "./_components/TodayCard";
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

  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const active = students.filter((s) => s.status === "active");

  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  // Until the tutor picks, the bar opens on their first student.
  const selection = selectedIds ?? (active[0] ? [active[0].id] : []);
  const selected = active.filter((s) => selection.includes(s.id));

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

  const who =
    identity.role === "tutor"
      ? (db.tutors.find((t) => t.id === identity.tutorId)?.name ?? "Tutor")
      : "LVAEP staff";

  return (
    <div className="mx-auto max-w-[1560px] px-5 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">{who}</h1>
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
                  {count} sheet{count === 1 ? "" : "s"} still to send for{" "}
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
          <LoggingBar
            students={active}
            selectedIds={selection}
            onSelectedIdsChange={setSelectedIds}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(220px,1fr)_3fr]">
            <aside className="lg:sticky lg:top-[68px] lg:self-start">
              <GoalsColumn students={selected} />
            </aside>

            <div className="min-w-0 space-y-6">
              <TodayCard students={active} />
              <div>
                <StudentSidebar students={students} showStatus />
                <div className="mt-3">
                  <AddStudentDialog />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
