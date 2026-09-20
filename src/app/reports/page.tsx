"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DownloadIcon } from "lucide-react";
import {
  CURRENT_FY,
  hoursInMonth,
  isSubmitted,
  sessionsInMonth,
  useStore,
} from "@/lib/store";
import {
  fiscalMonths,
  fiscalYearLabel,
  formatHours,
  monthKey,
  monthLabel,
  todayISO,
} from "@/lib/fy";
import { goalLabel } from "@/lib/goals";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ReportsPage() {
  const { db } = useStore();
  const months = useMemo(() => fiscalMonths(CURRENT_FY), []);
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [tutorId, setTutorId] = useState("all");

  const rows = useMemo(() => {
    return db.students
      .filter((s) => tutorId === "all" || s.tutorId === tutorId)
      .map((student) => {
        const hours = hoursInMonth(db.entries, student.id, month);
        const sessions = sessionsInMonth(db.entries, student.id, month);
        const missed = db.entries.filter(
          (e) => e.studentId === student.id && monthKey(e.date) === month && e.code,
        ).length;
        const goals = [
          ...Object.entries(student.goals)
            .filter(([, mark]) => monthKey(mark.attainedOn) === month)
            .map(([code]) => goalLabel(code)),
          ...student.otherGoals
            .filter((g) => g.attainedOn && monthKey(g.attainedOn) === month)
            .map((g) => g.label),
        ];
        return {
          student,
          tutor: db.tutors.find((t) => t.id === student.tutorId)?.name ?? "Unassigned",
          hours,
          sessions,
          missed,
          goals,
          sent: isSubmitted(db, student.id, month),
          stoppedThisMonth:
            student.stopped && monthKey(student.stopped.on) === month ? student.stopped : null,
        };
      })
      .sort((a, b) => a.tutor.localeCompare(b.tutor) || a.student.name.localeCompare(b.student.name));
  }, [db, month, tutorId]);

  const totals = rows.reduce(
    (acc, r) => ({
      hours: acc.hours + r.hours,
      sessions: acc.sessions + r.sessions,
      goals: acc.goals + r.goals.length,
      sent: acc.sent + (r.sent ? 1 : 0),
    }),
    { hours: 0, sessions: 0, goals: 0, sent: 0 },
  );

  const expected = rows.filter((r) => !r.student.stopped || r.stoppedThisMonth).length;

  function exportCsv() {
    const header = [
      "Month",
      "Tutor",
      "Student",
      "Hours",
      "Sessions",
      "Missed",
      "Goals attained",
      "Sheet received",
      "Stopped",
    ];
    const body = rows.map((r) => [
      monthLabel(month),
      r.tutor,
      r.student.name,
      formatHours(r.hours),
      String(r.sessions),
      String(r.missed),
      r.goals.join("; "),
      r.sent ? "yes" : "no",
      r.stoppedThisMonth ? r.stoppedThisMonth.reason : "",
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lvaep-${month}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none">Monthly reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every student sheet for {fiscalYearLabel(CURRENT_FY)}, collected as tutors send them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddStudentDialog />
          <Button variant="outline" onClick={exportCsv}>
            <DownloadIcon /> Export {monthLabel(month)} as CSV
          </Button>
        </div>
      </div>

      <Card className="mb-5 py-0">
        <CardContent className="flex flex-wrap items-end gap-6 px-4 py-4">
          <Field className="w-auto">
            <FieldLabel htmlFor="report-month">Month</FieldLabel>
            <NativeSelect
              id="report-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {months.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {monthLabel(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field className="w-auto">
            <FieldLabel htmlFor="report-tutor">Tutor</FieldLabel>
            <NativeSelect
              id="report-tutor"
              value={tutorId}
              onChange={(e) => setTutorId(e.target.value)}
            >
              <NativeSelectOption value="all">All tutors</NativeSelectOption>
              {db.tutors.map((t) => (
                <NativeSelectOption key={t.id} value={t.id}>
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <dl className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Hours" value={formatHours(totals.hours)} accent />
            <Stat label="Sessions" value={String(totals.sessions)} />
            <Stat label="Goals attained" value={String(totals.goals)} />
            <Stat label="Sheets in" value={`${totals.sent}/${expected}`} />
          </dl>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tutor</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Missed</TableHead>
              <TableHead>Goals attained</TableHead>
              <TableHead>Sheet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.student.id}>
                <TableCell className="text-muted-foreground">{r.tutor}</TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/students/${r.student.id}/sheet`}
                    className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                  >
                    {r.student.name}
                  </Link>
                  {r.stoppedThisMonth && (
                    <span className="ml-2 text-xs text-destructive">
                      stopped — {r.stoppedThisMonth.reason}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatHours(r.hours)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.missed || "—"}
                </TableCell>
                <TableCell className="max-w-[320px]">
                  {r.goals.length ? (
                    <span className="flex flex-wrap gap-1">
                      {r.goals.map((g) => (
                        <Badge key={g} variant="secondary" className="font-normal">
                          {g}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.sent ? (
                    <Badge>Received</Badge>
                  ) : r.student.stopped && !r.stoppedThisMonth ? (
                    <Badge variant="outline">Not tutoring</Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive text-destructive">
                      Waiting
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                {monthLabel(month)} total
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatHours(totals.hours)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {totals.sessions}
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-2xl font-semibold tabular-nums ${accent ? "text-lime-deep" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
