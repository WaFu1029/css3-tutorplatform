"use client";

import Link from "next/link";
import { toast } from "sonner";
import { cn } from "cn";
import type { DB, Student } from "@/lib/types";
import { FY_MONTHS, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { hoursInMonth, isSubmitted, sessionsInMonth, useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MonthClose({
  student,
  months,
  db,
}: {
  student: Student;
  months: string[];
  db: DB;
}) {
  const { submitMonth, unsubmitMonth } = useStore();
  const current = monthKey(todayISO());
  const hours = hoursInMonth(db.entries, student.id, current);
  const sessions = sessionsInMonth(db.entries, student.id, current);
  const missed = db.entries.filter(
    (e) => e.studentId === student.id && monthKey(e.date) === current && e.code,
  ).length;
  const submitted = isSubmitted(db, student.id, current);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{monthLabel(current)}</CardTitle>
        <CardAction>
          <Badge variant={submitted ? "secondary" : "outline"}>
            {submitted ? "Sent" : "Open"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl className="grid grid-cols-3 gap-4">
          <Stat label="Hours" value={formatHours(hours)} />
          <Stat label="Sessions" value={String(sessions)} />
          <Stat label="Missed" value={String(missed)} />
        </dl>

        {submitted ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {monthLabel(current)} is with the office.
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => unsubmitMonth(student.id, current)}
            >
              Reopen this month
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => {
                submitMonth(student.id, current);
                toast.success(`${monthLabel(current)} sent to the office`, {
                  description: `${student.name} · ${formatHours(hours)} hours`,
                });
              }}
            >
              Send {monthLabel(current).split(" ")[0]} to the office
            </Button>
            <p className="text-xs text-muted-foreground">
              You can reopen it if something changes.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">This fiscal year</p>
          <ol className="flex gap-1">
            {months.map((month, i) => {
              const done = isSubmitted(db, student.id, month);
              const monthHours = hoursInMonth(db.entries, student.id, month);
              const future = month > current;
              return (
                <li key={month} className="flex-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div
                          className={cn(
                            "h-6 rounded-sm text-center text-[10px] leading-6",
                            done && "bg-ink text-lime",
                            !done && future && "bg-muted text-muted-foreground",
                            !done && !future && "bg-lime text-ink",
                          )}
                        >
                          {FY_MONTHS[i]}
                        </div>
                      }
                    />
                    <TooltipContent>
                      {monthLabel(month)} ·{" "}
                      {future
                        ? "not started"
                        : `${formatHours(monthHours)} h, ${done ? "sent" : "open"}`}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted-foreground">
            July through June. Lime is open with hours logged, ink is sent to the office.
          </p>
        </div>

        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          nativeButton={false}
          render={<Link href={`/students/${student.id}/sheet`} />}
        >
          View the printable year sheet
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
