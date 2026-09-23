"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
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
import {
  buildRows,
  sheetHref,
  shortDates,
  skipReason,
  studentMonthHref,
  type ReportRow,
} from "../_lib/report";
import { MonthPicker, Stat, StatusBadge } from "./parts";

type SendResult = {
  month: string;
  sent: string[];
  skipped: { name: string; reason: string }[];
};

export function TutorReports({ months, month, onMonth }: {
  months: string[];
  month: string;
  onMonth: (m: string) => void;
}) {
  const { db, identity, sendMonth, reopenMonth } = useStore();
  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const rows = useMemo(() => buildRows(db, students, month), [db, students, month]);
  const [result, setResult] = useState<SendResult | null>(null);

  const ready = rows.filter((r) => r.status === "ready");
  const totals = rows.reduce(
    (acc, r) => ({
      hours: acc.hours + r.hours,
      sessions: acc.sessions + r.sessions,
      missed: acc.missed + r.missed,
      gaps: acc.gaps + r.gaps.length,
    }),
    { hours: 0, sessions: 0, missed: 0, gaps: 0 },
  );
  const sentCount = rows.filter((r) => r.status === "sent").length;

  function sendAllReady() {
    const sent: string[] = [];
    const skipped: SendResult["skipped"] = [];
    for (const r of rows) {
      const reason = skipReason(r);
      if (reason) skipped.push({ name: r.student.name, reason });
      else if (r.status !== "ready") continue;
      // The store re-checks for gaps and refuses if one has appeared.
      else if (sendMonth(r.student.id, month)) sent.push(r.student.name);
      else skipped.push({ name: r.student.name, reason: "the store refused it; reload and retry" });
    }
    setResult({ month, sent, skipped });
    toast.success(
      `Sent ${sent.length} ${monthLabel(month)} report${sent.length === 1 ? "" : "s"}`,
      skipped.length ? { description: `${skipped.length} skipped — see the list above the table.` } : undefined,
    );
  }

  function sendOne(r: ReportRow) {
    if (!sendMonth(r.student.id, month)) {
      toast.error(`${r.student.name}'s ${monthLabel(month)} still has unlogged sessions`);
      return;
    }
    toast.success(`${monthLabel(month)} sent to the office`, {
      description: `${r.student.name} · ${formatHours(r.hours)} hours`,
    });
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Your monthly reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The sheet you send the office for each of your students, {fiscalYearLabel(CURRENT_FY)}.
            A month can go once every scheduled session is logged.
          </p>
        </div>
        <Button onClick={sendAllReady} disabled={ready.length === 0}>
          <SendIcon /> Send all ready ({ready.length})
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-6">
          <MonthPicker
            months={months}
            value={month}
            onChange={(m) => {
              onMonth(m);
              setResult(null);
            }}
          />
          <dl className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Hours" value={formatHours(totals.hours)} accent />
            <Stat label="Sessions" value={String(totals.sessions)} />
            <Stat label="Missed" value={String(totals.missed)} />
            <Stat label="Unlogged" value={String(totals.gaps)} />
            <Stat label="Sent" value={`${sentCount}/${rows.length}`} />
          </dl>
        </CardContent>
      </Card>

      {result && result.month === month && (
        <Card className="mb-6" role="status">
          <CardContent className="flex items-start gap-4">
            <div className="flex-1 space-y-2 text-sm">
              <p className="font-medium">
                {result.sent.length
                  ? `Sent ${result.sent.join(", ")}.`
                  : "Nothing was ready to send."}
              </p>
              {result.skipped.length > 0 && (
                <div>
                  <p className="text-muted-foreground">Skipped:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {result.skipped.map((s) => (
                      <li key={s.name}>
                        <span className="font-medium">{s.name}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setResult(null)}>
              <XIcon />
            </Button>
          </CardContent>
        </Card>
      )}

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
                  <div className="font-medium">{r.student.name}</div>
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
                  {r.gaps.length ? (
                    <Link
                      href={studentMonthHref(r.student.id, month)}
                      className="text-destructive underline decoration-destructive/40 underline-offset-2 hover:decoration-destructive"
                    >
                      <span className="font-semibold tabular-nums">{r.gaps.length}</span>{" "}
                      <span className="text-xs">({shortDates(r.gaps, 3)})</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-2">
                    {r.status === "sent" ? (
                      <Button variant="ghost" size="sm" onClick={() => reopenMonth(r.student.id, month)}>
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={r.status !== "ready"}
                        onClick={() => sendOne(r)}
                      >
                        Send
                      </Button>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={sheetHref(r.student.id)} />}
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
