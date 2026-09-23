"use client";

import { Fragment, useMemo, useState } from "react";
import { AwardIcon, DownloadIcon, UserMinusIcon } from "lucide-react";
import { visibleStudents } from "@/lib/permissions";
import { CURRENT_FY, useStore } from "@/lib/store";
import { formatDate, formatHours, fiscalYearLabel, monthLabel } from "@/lib/fy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  STATUS_LABEL,
  buildRows,
  downloadCsv,
  sessionsCsv,
  summaryCsv,
  type ReportRow,
} from "../_lib/report";
import { FilterSelect, GoalLabel, MonthPicker, SheetLinks, Stat, StatusBadge } from "./parts";

const STATUS_FILTERS = [
  { value: "all", label: "Any status" },
  { value: "unsent", label: "Not yet sent" },
  { value: "open", label: STATUS_LABEL.open },
  { value: "ready", label: STATUS_LABEL.ready },
  { value: "sent", label: STATUS_LABEL.sent },
];

function matchesStatus(row: ReportRow, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "unsent") return row.status === "open" || row.status === "ready";
  return row.status === filter;
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()];
}

export function StaffReports({ months, month, onMonth }: {
  months: string[];
  month: string;
  onMonth: (m: string) => void;
}) {
  const { db, identity } = useStore();
  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const all = useMemo(() => buildRows(db, students, month), [db, students, month]);

  const [tutorId, setTutorId] = useState("all");
  const [site, setSite] = useState("all");
  const [status, setStatus] = useState("all");

  const sites = useMemo(() => [...new Set(db.students.map((s) => s.site))].sort(), [db.students]);
  const rows = all.filter(
    (r) =>
      (tutorId === "all" || r.student.tutorId === tutorId) &&
      (site === "all" || r.student.site === site) &&
      matchesStatus(r, status),
  );

  // The office-wide panels ignore the filters: a stop or an achievement should
  // not disappear because someone narrowed the table to one site.
  const unsentByTutor = groupBy(
    all.filter((r) => r.status === "open" || r.status === "ready"),
    (r) => r.tutorName,
  );
  const stopped = all.filter((r) => r.stoppedThisMonth);
  const achievements = all.flatMap((r) => r.attained.map((g) => ({ row: r, goal: g })));
  const hoursBySite = groupBy(all, (r) => r.student.site)
    .map(([name, list]) => ({
      name,
      hours: list.reduce((sum, r) => sum + r.hours, 0),
      students: list.length,
    }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const totalHours = all.reduce((sum, r) => sum + r.hours, 0);
  const sentCount = all.filter((r) => r.status === "sent").length;
  const reportable = all.filter((r) => r.status !== "upcoming").length;

  const filteredHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const filteredSessions = rows.reduce((sum, r) => sum + r.sessions, 0);

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight tracking-tight">Monthly reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every student sheet for {fiscalYearLabel(CURRENT_FY)}, collected as tutors send them.
            Read only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadCsv(`lvaep-${month}-summary.csv`, summaryCsv(rows, month))}>
            <DownloadIcon /> Summary CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadCsv(`lvaep-${month}-sessions.csv`, sessionsCsv(rows, db.entries, month))}
          >
            <DownloadIcon /> Sessions CSV
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-6">
          <MonthPicker months={months} value={month} onChange={onMonth} />
          <FilterSelect
            id="report-tutor"
            label="Tutor"
            value={tutorId}
            options={[
              { value: "all", label: "All tutors" },
              ...db.tutors.map((t) => ({ value: t.id, label: t.name })),
            ]}
            onChange={setTutorId}
          />
          <FilterSelect
            id="report-site"
            label="Site"
            value={site}
            options={[{ value: "all", label: "All sites" }, ...sites.map((s) => ({ value: s, label: s }))]}
            onChange={setSite}
          />
          <FilterSelect id="report-status" label="Status" value={status} options={STATUS_FILTERS} onChange={setStatus} />
          <dl className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Hours this month" value={formatHours(totalHours)} accent />
            <Stat label="Sheets in" value={`${sentCount}/${reportable}`} />
          </dl>
        </CardContent>
      </Card>

      {stopped.length > 0 && (
        <Card className="mb-6 bg-destructive/10 text-destructive" role="alert">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <UserMinusIcon className="size-4" />
              Stopped in {monthLabel(month)} — the form asks tutors to notify the office right away
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-foreground">
              {stopped.map((r) => (
                <li key={r.student.id}>
                  <span className="font-medium">{r.student.name}</span>{" "}
                  <span className="text-muted-foreground">
                    ({r.tutorName}, {r.student.site}) · {formatDate(r.stoppedThisMonth!.on)}
                  </span>
                  {" — "}
                  {r.stoppedThisMonth!.reason || <em className="text-muted-foreground">no reason given</em>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Not yet sent</CardTitle>
          </CardHeader>
          <CardContent>
            {unsentByTutor.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {reportable ? "Every sheet for this month is in." : "Nothing to report for this month yet."}
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {unsentByTutor.map(([tutor, list]) => (
                  <li key={tutor}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{tutor}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{list.length} to send</span>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {list.map((r) => (
                        <li key={r.student.id} className="flex justify-between gap-2">
                          <span>{r.student.name}</span>
                          <span className="text-xs">
                            {r.status === "ready"
                              ? "ready, not sent"
                              : `${r.gaps.length} unlogged`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Hours by site</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1.5 text-sm">
              {hoursBySite.map((s) => (
                <div key={s.name} className="flex items-baseline justify-between gap-2">
                  <dt>
                    {s.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {s.students} student{s.students === 1 ? "" : "s"}
                    </span>
                  </dt>
                  <dd className="font-semibold tabular-nums">{formatHours(s.hours)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2 border-t pt-1.5">
                <dt className="font-medium">All sites</dt>
                <dd className="font-semibold tabular-nums text-primary">{formatHours(totalHours)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AwardIcon className="size-4" />
              Achievements in {monthLabel(month)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {achievements.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded this month.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {achievements.map(({ row, goal }) => (
                  <li key={`${row.student.id}-${goal.label}`}>
                    <span className="font-medium">
                      <GoalLabel label={goal.label} starred={goal.starred} />
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {row.student.name} · {row.tutorName} · {formatDate(goal.on)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {achievements.some((a) => a.goal.starred) && (
              <p className="mt-3 text-xs text-muted-foreground">* starred on the paper form</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden px-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Missed</TableHead>
              <TableHead className="text-right">Unlogged</TableHead>
              <TableHead>Goals</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Year sheet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No students match these filters.
                </TableCell>
              </TableRow>
            )}
            {groupBy(rows, (r) => r.tutorName).map(([tutor, list]) => (
              <Fragment key={tutor}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={2} className="font-serif text-base">
                    {tutor}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatHours(list.reduce((sum, r) => sum + r.hours, 0))}
                  </TableCell>
                  <TableCell colSpan={6} className="text-xs text-muted-foreground">
                    {list.filter((r) => r.status === "sent").length} of {list.length} sent
                  </TableCell>
                </TableRow>
                {list.map((r) => (
                  <TableRow key={r.student.id}>
                    <TableCell className="font-medium">
                      {r.student.name}
                      {r.stoppedThisMonth && (
                        <Badge variant="destructive" className="ml-2">
                          Stopped
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.student.site}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatHours(r.hours)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.missed || "—"}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${r.gaps.length ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {r.gaps.length || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.attained.length ? (
                        <span className="tabular-nums">{r.attained.length}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <SheetLinks studentId={r.student.id} name={r.student.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  {rows.length === all.length ? `${monthLabel(month)} total` : "Filtered total"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatHours(filteredHours)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{filteredSessions}</TableCell>
                <TableCell colSpan={5} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
}
