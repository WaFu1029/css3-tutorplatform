"use client";

import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import type { MonthReport, SessionEntry, Student } from "@/lib/types";
import { ABSENCE_CODES, ABSENCE_LABEL } from "@/lib/absence";
import { formatDate, formatHours, MONTH_NAMES, monthKey, todayISO } from "@/lib/fy";
import { useStore, type EntryValue } from "@/lib/store";
import type { MonthSummary as Summary } from "@/lib/logic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { heldHours } from "../_lib/helpers";

export function MonthSummary({
  student,
  month,
  summary,
  report,
  entries,
}: {
  student: Student;
  month: string;
  summary: Summary;
  report: MonthReport | undefined;
  entries: SessionEntry[];
}) {
  const { sendMonth, reopenMonth, saveEntries } = useStore();
  const sent = report?.status === "sent";
  const name = MONTH_NAMES[Number(month.slice(5)) - 1];
  const notStarted = month > monthKey(todayISO());
  const sendable = summary.gaps.length === 0 && !notStarted;

  function resolve(date: string, value: EntryValue) {
    saveEntries([student.id], date, value);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{name} summary</CardTitle>
        <CardAction>
          {sent ? (
            <Badge>
              <CheckIcon /> Sent
            </Badge>
          ) : notStarted ? (
            <Badge variant="outline">Not started</Badge>
          ) : (
            <Badge variant="outline">Open</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Hours" value={formatHours(summary.hours)} accent />
          <Stat label="Sessions" value={String(summary.sessions)} />
          <Stat label="Missed" value={String(summary.missed)} />
        </dl>

        {sent ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sent to the office{report?.sentAt ? ` ${formatDate(report.sentAt.slice(0, 10))}` : ""}.
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
            <Button
              className="w-full"
              disabled={!sendable}
              onClick={() => {
                if (!sendMonth(student.id, month)) return;
                toast.success(`${name} sent to the office`, {
                  description: `${student.name} · ${formatHours(summary.hours)} hours`,
                });
              }}
            >
              Send {name} to the office
            </Button>

            {notStarted ? (
              <p className="text-xs text-muted-foreground">{name} hasn&apos;t started yet.</p>
            ) : summary.gaps.length > 0 ? (
              <GapList
                gaps={summary.gaps}
                held={(date) => heldHours(student, date, entries)}
                onResolve={resolve}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Every scheduled day is accounted for. You can reopen it after sending.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GapList({
  gaps,
  held,
  onResolve,
}: {
  gaps: string[];
  /** What one click on "held" records for that date. */
  held: (date: string) => number;
  onResolve: (date: string, value: EntryValue) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-medium">
          {gaps.length} scheduled day{gaps.length === 1 ? "" : "s"} not logged.
        </span>{" "}
        <span className="text-muted-foreground">Account for each before sending.</span>
      </p>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {gaps.map((date) => {
          const hours = held(date);
          return (
          <li
            key={date}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-destructive/10 py-1 pr-1 pl-2.5"
          >
            <span className="text-sm font-medium tabular-nums">{formatDate(date)}</span>
            <span className="flex items-center gap-1">
              <Button
                size="xs"
                variant="ghost"
                className="bg-background hover:bg-muted"
                onClick={() => onResolve(date, { hours })}
              >
                Held {formatHours(hours)}h
              </Button>
              {ABSENCE_CODES.map((code) => (
                <Tooltip key={code}>
                  <TooltipTrigger
                    render={
                      <Button
                        size="xs"
                        variant="ghost"
                        className="bg-background hover:bg-muted"
                        aria-label={`${ABSENCE_LABEL[code]} on ${formatDate(date)}`}
                        onClick={() => onResolve(date, { code })}
                      >
                        {code}
                      </Button>
                    }
                  />
                  <TooltipContent>{ABSENCE_LABEL[code]}</TooltipContent>
                </Tooltip>
              ))}
            </span>
          </li>
          );
        })}
      </ul>
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
