"use client";

import Link from "next/link";
import { toast } from "sonner";
import { FileTextIcon } from "lucide-react";
import type { MonthReport, Student } from "@/lib/types";
import { formatDate, formatHours, MONTH_NAMES } from "@/lib/fy";
import { useStore } from "@/lib/store";
import type { MonthStatus, MonthSummary as Summary } from "@/lib/logic";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthStatusBadge } from "@/components/MonthStatusBadge";
import { SendMonthButton } from "@/components/SendReview";
import { UnloggedDayActions } from "@/components/UnloggedDayActions";

export function MonthSummary({
  student,
  month,
  summary,
  report,
  status,
  compact = false,
}: {
  student: Student;
  month: string;
  summary: Summary;
  report: MonthReport | undefined;
  status: MonthStatus;
  /**
   * One strip across the top of the calendar instead of a card. Unlogged days
   * are counted on the badge; the calendar marks them and the day panel logs them.
   */
  compact?: boolean;
}) {
  const { reopenMonth } = useStore();
  const sent = report?.status === "sent";
  const name = MONTH_NAMES[Number(month.slice(5)) - 1];

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <MonthStatusBadge status={status} unlogged={summary.unlogged.length} />
          <dl className="flex items-baseline gap-x-5">
            <InlineStat label="Hours" value={formatHours(summary.hours)} accent />
            <InlineStat label="Sessions" value={String(summary.sessions)} />
            <InlineStat label="Missed" value={String(summary.missed)} />
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSheetLink student={student} month={month} name={name} size="sm" />
          {sent ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Confirmed{report?.sentAt ? ` ${formatDate(report.sentAt.slice(0, 10))}` : ""}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  reopenMonth(student.id, month);
                  toast.info(`${name} reopened`, { description: student.name });
                }}
              >
                Reopen {name}
              </Button>
            </div>
          ) : (
            <SendMonthButton student={student} month={month} size="sm">
              Confirm {name}
            </SendMonthButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{name} summary</CardTitle>
        <CardAction>
          <MonthStatusBadge status={status} unlogged={summary.unlogged.length} />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Hours" value={formatHours(summary.hours)} accent />
          <Stat label="Sessions" value={String(summary.sessions)} />
          <Stat label="Missed" value={String(summary.missed)} />
        </dl>

        <MonthSheetLink student={student} month={month} name={name} className="w-full" />

        {sent ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Confirmed{report?.sentAt ? ` ${formatDate(report.sentAt.slice(0, 10))}` : ""}.
              Reopen it to change an entry.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                reopenMonth(student.id, month);
                toast.info(`${name} reopened`, { description: student.name });
              }}
            >
              Reopen {name}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <SendMonthButton student={student} month={month} className="w-full">
              Confirm {name}
            </SendMonthButton>

            {summary.unlogged.length > 0 ? (
              <UnloggedList student={student} dates={summary.unlogged} />
            ) : (
              <p className="text-xs text-muted-foreground">
                {status === "not-started"
                  ? `${name} hasn't started yet.`
                  : "Nothing scheduled is waiting to be logged. You can reopen a month after confirming."}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UnloggedList({ student, dates }: { student: Student; dates: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-medium">
          {dates.length} unlogged scheduled day{dates.length === 1 ? "" : "s"}.
        </span>{" "}
        <span className="text-muted-foreground">Log or dismiss them, or confirm as it is.</span>
      </p>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {dates.map((date) => (
          <li
            key={date}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-foreground/20 py-1 pr-1 pl-2.5"
          >
            <span className="text-sm font-medium tabular-nums">{formatDate(date)}</span>
            <UnloggedDayActions student={student} date={date} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The printable sheet for just this month, as the office receives it. */
function MonthSheetLink({
  student,
  month,
  name,
  size,
  className,
}: {
  student: Student;
  month: string;
  name: string;
  size?: "sm";
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      nativeButton={false}
      render={<Link href={`/students/${student.id}/sheet/${month}`} />}
    >
      <FileTextIcon /> {name} sheet
    </Button>
  );
}

function InlineStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-3xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
