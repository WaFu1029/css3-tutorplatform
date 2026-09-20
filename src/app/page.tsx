"use client";

import { useEffect, useMemo, useState } from "react";
import { UsersIcon } from "lucide-react";
import { CURRENT_FY, entryIndex, hoursInMonth, isSubmitted, useStore } from "@/lib/store";
import { fiscalMonths, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { visibleStudents } from "@/lib/permissions";
import { Ledger } from "@/components/Ledger";
import { QuickLog } from "@/components/QuickLog";
import { GoalsPanel } from "@/components/GoalsPanel";
import { MonthClose } from "@/components/MonthClose";
import { StudentDetails } from "@/components/StudentDetails";
import { StudentRail } from "@/components/StudentRail";
import { RequirePermission } from "@/components/RequirePermission";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { Badge } from "@/components/ui/badge";
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
  const { db, identity, setEntry, clearEntry } = useStore();
  const months = useMemo(() => fiscalMonths(CURRENT_FY), []);
  const current = monthKey(todayISO());

  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);

  const [activeId, setActiveId] = useState(students[0]?.id ?? "");
  useEffect(() => {
    if (!students.some((s) => s.id === activeId)) setActiveId(students[0]?.id ?? "");
  }, [students, activeId]);

  const student = students.find((s) => s.id === activeId);
  const index = useMemo(() => entryIndex(db.entries), [db.entries]);

  const monthHours = students.reduce(
    (sum, s) => sum + hoursInMonth(db.entries, s.id, current),
    0,
  );
  const outstanding = students.filter(
    (s) => !isSubmitted(db, s.id, current) && !s.stopped,
  ).length;

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
        {outstanding > 0 && (
          <Badge variant="secondary" className="h-6 px-2.5">
            {outstanding} sheet{outstanding === 1 ? "" : "s"} still to send for{" "}
            {monthLabel(current).split(" ")[0]}
          </Badge>
        )}
      </div>

      {students.length === 0 || !student ? (
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
          <QuickLog
            students={students}
            activeStudentId={activeId}
            onPickStudent={setActiveId}
          />

          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-[68px] lg:self-start">
              <StudentRail
                students={students}
                db={db}
                activeId={activeId}
                onPick={setActiveId}
              />
              <div className="mt-3">
                <AddStudentDialog />
              </div>
            </aside>

            <div className="min-w-0 space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl leading-tight tracking-tight">{student.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {student.site} · {student.days} · {student.times}
                </p>
              </div>

              <Ledger
                months={months}
                entries={index}
                studentId={student.id}
                startedOn={student.startedOn}
                stoppedOn={student.stopped?.on ?? null}
                onSet={(date, hours, code) => setEntry(student.id, date, hours, code)}
                onClear={(date) => clearEntry(student.id, date)}
              />

              <div className="grid gap-6 xl:grid-cols-2">
                <GoalsPanel student={student} />
                <div className="space-y-6">
                  <MonthClose student={student} months={months} db={db} />
                  <StudentDetails student={student} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
