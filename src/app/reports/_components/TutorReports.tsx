"use client";

import Link from "next/link";
import { useMemo } from "react";
import { visibleStudents } from "@/lib/permissions";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalYearLabel, formatHours, monthLabel } from "@/lib/fy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthStatusBadge } from "@/components/MonthStatusBadge";
import { SendAllButton, SendMonthButton } from "@/components/SendReview";
import { buildRows, reportYears, sheetHref, shortDates, studentMonthHref } from "../_lib/report";
import { fiscalYearOfMonth, PeriodPicker, Stat } from "./parts";

export function TutorReports({ month, onMonth }: {
  /** Any month; the Year picker moves it between fiscal years. */
  month: string;
  onMonth: (m: string) => void;
}) {
  const { db, identity, reopenMonth } = useStore();
  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const rows = useMemo(() => buildRows(db, students, month), [db, students, month]);

  // Everything open goes; the review before sending shows anything that looks missing.
  const open = rows.filter((r) => r.status === "open");
  const totals = rows.reduce(
    (acc, r) => ({
      hours: acc.hours + r.hours,
      sessions: acc.sessions + r.sessions,
      missed: acc.missed + r.missed,
      unlogged: acc.unlogged + (r.status === "sent" ? 0 : r.unlogged.length),
    }),
    { hours: 0, sessions: 0, missed: 0, unlogged: 0 },
  );
  const sentCount = rows.filter((r) => r.status === "sent").length;

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Your monthly reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The sheet you confirm for the office for each of your students, {fiscalYearLabel(CURRENT_FY)}.
            Confirm when you&apos;re ready; you&apos;ll get a quick look at anything that seems missing first.
          </p>
        </div>
        <SendAllButton students={open.map((r) => r.student)} month={month} />
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-6">
          <PeriodPicker years={reportYears(db, CURRENT_FY)} month={month} onChange={onMonth} />
          <dl className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Hours" value={formatHours(totals.hours)} accent />
            <Stat label="Sessions" value={String(totals.sessions)} />
            <Stat label="Missed" value={String(totals.missed)} />
            <Stat label="Unlogged" value={String(totals.unlogged)} />
            <Stat label="Confirmed" value={`${sentCount}/${rows.length}`} />
          </dl>
        </CardContent>
      </Card>

      <Card className="overflow-hidden px-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Missed</TableHead>
              <TableHead>Unlogged</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No students were enrolled with you in {monthLabel(month)}.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.student.id}>
                <TableCell>
                  <Link
                    href={studentMonthHref(r.student.id, month)}
                    className="font-medium underline decoration-border underline-offset-2 hover:decoration-foreground"
                  >
                    {r.student.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {r.student.site}
                    {r.stoppedThisMonth && (
                      <span className="text-destructive"> · stopped {r.stoppedThisMonth.on}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatHours(r.hours)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.missed || "—"}
                </TableCell>
                <TableCell>
                  {r.unlogged.length && r.status !== "sent" ? (
                    <Link
                      href={studentMonthHref(r.student.id, month)}
                      className="text-muted-foreground underline decoration-dashed decoration-foreground/30 underline-offset-2 hover:text-foreground"
                    >
                      <span className="font-semibold tabular-nums">{r.unlogged.length}</span>{" "}
                      <span className="text-xs">({shortDates(r.unlogged, 3)})</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <MonthStatusBadge status={r.status} className="justify-start" />
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-2">
                    {r.status === "sent" ? (
                      <Button variant="ghost" size="sm" onClick={() => reopenMonth(r.student.id, month)}>
                        Reopen
                      </Button>
                    ) : (
                      <SendMonthButton student={r.student} month={month} variant="outline" size="sm">
                        Confirm
                      </SendMonthButton>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={sheetHref(r.student.id, false, month)} />}
                    >
                      Month sheet
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={sheetHref(r.student.id, false, undefined, fiscalYearOfMonth(month))} />}
                    >
                      Year sheet
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">{monthLabel(month)} total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatHours(totals.hours)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{totals.sessions}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{totals.missed}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
}
