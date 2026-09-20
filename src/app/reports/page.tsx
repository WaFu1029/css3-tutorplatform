"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DownloadIcon } from "lucide-react";
import { RequirePermission } from "@/components/RequirePermission";
import { can, visibleStudents } from "@/lib/permissions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  return (
    <RequirePermission permission="reports:view">
      <Reports />
    </RequirePermission>
  );
}

function Reports() {
  const { db, identity } = useStore();
  // A tutor's reports are their own students', and the filter cannot widen
  // that: the scope below is applied before the dropdown is consulted.
  const scoped = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const canPickTutor = can(identity, "reports:viewAll");
  const months = useMemo(() => fiscalMonths(CURRENT_FY), []);
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [tutorId, setTutorId] = useState("all");

  const rows = useMemo(() => {
    return scoped
      .filter((s) => !canPickTutor || tutorId === "all" || s.tutorId === tutorId)
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
  }, [db, scoped, canPickTutor, month, tutorId]);

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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">
            {canPickTutor ? "Monthly reports" : "Your monthly reports"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {canPickTutor
              ? `Every student sheet for ${fiscalYearLabel(CURRENT_FY)}, collected as tutors send them.`
              : `The sheet you send the office for each of your students, ${fiscalYearLabel(CURRENT_FY)}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(identity, "students:manage") && <AddStudentDialog />}
          <Button variant="outline" onClick={exportCsv}>
            <DownloadIcon /> Export {monthLabel(month)} as CSV
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-6">
          <Field className="w-auto">
            <FieldLabel htmlFor="report-month">Month</FieldLabel>
            <Select
              items={Object.fromEntries(months.map((m) => [m, monthLabel(m)]))}
              value={month}
              onValueChange={(value: string | null) => value && setMonth(value)}
            >
              <SelectTrigger id="report-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {canPickTutor && (
            <Field className="w-auto">
              <FieldLabel htmlFor="report-tutor">Tutor</FieldLabel>
              <Select
                items={{
                  all: "All tutors",
                  ...Object.fromEntries(db.tutors.map((t) => [t.id, t.name])),
                }}
                value={tutorId}
                onValueChange={(value: string | null) => value && setTutorId(value)}
              >
                <SelectTrigger id="report-tutor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tutors</SelectItem>
                  {db.tutors.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <dl className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Hours" value={formatHours(totals.hours)} accent />
            <Stat label="Sessions" value={String(totals.sessions)} />
            <Stat label="Goals attained" value={String(totals.goals)} />
            <Stat label="Sheets in" value={`${totals.sent}/${expected}`} />
          </dl>
        </CardContent>
      </Card>

      <Card className="overflow-hidden px-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              {canPickTutor && <TableHead>Tutor</TableHead>}
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
                {canPickTutor && (
                  <TableCell className="text-muted-foreground">{r.tutor}</TableCell>
                )}
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
                    <Badge variant="outline" className="text-destructive">
                      Waiting
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={canPickTutor ? 2 : 1} className="font-medium">
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
        className={`text-2xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
