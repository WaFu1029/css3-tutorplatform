"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { AwardIcon, DownloadIcon, UserMinusIcon, XIcon } from "lucide-react";
import { visibleStudents } from "@/lib/permissions";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalYearLabel, formatDate, formatHours, monthLabel } from "@/lib/fy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { expectsReport, MONTH_STATUS_LABEL } from "@/lib/logic";
import { MonthStatusBadge } from "@/components/MonthStatusBadge";
import {
  buildRows,
  downloadCsv,
  reportYears,
  sessionsCsv,
  type ReportRow,
} from "../_lib/report";
import {
  FilterSelect,
  GoalLabel,
  PeriodPicker,
  fiscalYearOfMonth,
  RestoreWarningsLink,
  SheetLinks,
  Stat,
  useUnconfirmedGuard,
} from "./parts";

const STATUS_FILTERS = [
  { value: "all", label: "Any status" },
  { value: "open", label: MONTH_STATUS_LABEL.open },
  { value: "sent", label: MONTH_STATUS_LABEL.sent },
  { value: "not-started", label: MONTH_STATUS_LABEL["not-started"] },
  { value: "unlogged", label: "With unlogged days" },
];

function matchesStatus(row: ReportRow, filter: string): boolean {
  if (filter === "all") return true;
  // Unlogged days sit beside the status, so this filter cuts across it.
  if (filter === "unlogged") return row.status !== "sent" && row.unlogged.length > 0;
  return row.status === filter;
}

/* ---------- acknowledged stops (this browser only) ---------- */

const SEEN_STOPS_KEY = "lvaep.reports.seenStops";

function stopKey(row: ReportRow): string {
  return `${row.student.id}:${row.stoppedThisMonth?.on ?? ""}`;
}

function loadSeenStops(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_STOPS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenStops(keys: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_STOPS_KEY, JSON.stringify([...keys]));
  } catch {
    // Storage blocked: the dismissal just won't outlast the page.
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()];
}

export function StaffReports({ month, onMonth, lockTutorId }: {
  /** Any month; the Year picker moves it between fiscal years. */
  month: string;
  onMonth: (m: string) => void;
  /**
   * Shows one tutor's reports only, inside their profile on the Tutors tab:
   * no tutor filter, no page title or padding of its own.
   */
  lockTutorId?: string;
}) {
  const { db, identity } = useStore();
  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const all = useMemo(() => buildRows(db, students, month), [db, students, month]);

  const [tutorId, setTutorId] = useState(lockTutorId ?? "all");
  const [site, setSite] = useState("all");
  const [status, setStatus] = useState("all");
  const [seenStops, setSeenStops] = useState<Set<string>>(loadSeenStops);

  const sites = useMemo(() => [...new Set(db.students.map((s) => s.site))].sort(), [db.students]);
  // Tutor and site narrow everything on the page: the panels, the alert and
  // the totals. Status only narrows the table, or filtering to "Confirmed" would
  // empty "Not yet confirmed".
  const scoped = all.filter(
    (r) =>
      (tutorId === "all" || r.student.tutorId === tutorId) &&
      (site === "all" || r.student.site === site),
  );
  const rows = scoped.filter((r) => matchesStatus(r, status));

  // Staff are asked before reading or exporting what a tutor hasn't confirmed.
  const { guard, dialog: exportDialog } = useUnconfirmedGuard();
  const monthUnconfirmed = (r: (typeof rows)[number]) =>
    r.status !== "sent" && expectsReport(r.student, month) ? [month] : [];

  function exportSessions() {
    const pending = rows.filter((r) => monthUnconfirmed(r).length > 0);
    const names = pending.map((r) => r.student.name);
    const listed =
      names.length > 4
        ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more`
        : names.join(", ");
    guard(
      pending.length
        ? {
            kind: "export",
            title: `${pending.length} of ${rows.length} not confirmed`,
            body: `${monthLabel(month)} isn't confirmed yet for ${listed}. Their sessions will be in the export, but may still change.`,
            action: "Export anyway",
          }
        : null,
      () => downloadCsv(`lvaep-${month}-sessions.csv`, sessionsCsv(rows, db, month)),
    );
  }

  const unsentByTutor = groupBy(
    scoped.filter((r) => r.status === "open"),
    (r) => r.tutorName,
  );
  // Stops this viewer has already acknowledged stay off the banner; a new stop brings it back.
  const stopped = scoped.filter((r) => r.stoppedThisMonth && !seenStops.has(stopKey(r)));

  function dismissStops() {
    const before = seenStops;
    const next = new Set([...seenStops, ...stopped.map(stopKey)]);
    setSeenStops(next);
    saveSeenStops(next);
    toast("Stop notice dismissed", {
      description: "They still show as Stopped in the table.",
      action: {
        label: "Undo",
        onClick: () => {
          setSeenStops(before);
          saveSeenStops(before);
        },
      },
    });
  }
  const achievements = scoped.flatMap((r) => r.attained.map((g) => ({ row: r, goal: g })));
  const hoursBySite = groupBy(scoped, (r) => r.student.site)
    .map(([name, list]) => ({
      name,
      hours: list.reduce((sum, r) => sum + r.hours, 0),
      students: list.length,
    }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  const totalHours = scoped.reduce((sum, r) => sum + r.hours, 0);
  const sentCount = scoped.filter((r) => r.status === "sent").length;
  const reportable = scoped.filter((r) => r.status !== "not-started").length;

  const filteredHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const filteredSessions = rows.reduce((sum, r) => sum + r.sessions, 0);

  return (
    <div className={lockTutorId ? undefined : "mx-auto max-w-[1280px] px-5 py-6"}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        {lockTutorId ? (
          <p className="text-sm text-muted-foreground">
            This tutor&apos;s student sheets for {fiscalYearLabel(CURRENT_FY)}. Read only.
          </p>
        ) : (
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">Monthly reports</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Every student sheet for {fiscalYearLabel(CURRENT_FY)}, collected as tutors confirm them.
              Read only.
            </p>
          </div>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-6">
          <PeriodPicker years={reportYears(db, CURRENT_FY)} month={month} onChange={onMonth} />
          {!lockTutorId && (
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
          )}
          <FilterSelect
            id="report-site"
            label="Site"
            value={site}
            options={[{ value: "all", label: "All sites" }, ...sites.map((s) => ({ value: s, label: s }))]}
            onChange={setSite}
          />
          <FilterSelect id="report-status" label="Status" value={status} options={STATUS_FILTERS} onChange={setStatus} />
          {/* Exports what the filters show, so it sits with them. */}
          <Button variant="outline" onClick={exportSessions}>
            <DownloadIcon /> Export month sessions CSV
          </Button>
          {exportDialog}
          <RestoreWarningsLink />
          <dl className="ml-auto flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Hours this month" value={formatHours(totalHours)} accent />
            <Stat label="Confirmed" value={`${sentCount}/${reportable}`} />
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
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss stop notice"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={dismissStops}
              >
                <XIcon />
              </Button>
            </CardAction>
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
            <CardTitle className="text-sm font-medium">Not yet confirmed</CardTitle>
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
                      <span className="text-xs text-muted-foreground tabular-nums">{list.length} to confirm</span>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {list.map((r) => (
                        <li key={r.student.id} className="flex justify-between gap-2">
                          <span>{r.student.name}</span>
                          <span className="text-xs">
                            {r.unlogged.length ? `open · ${r.unlogged.length} unlogged` : "open"}
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
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Missed</TableHead>
              <TableHead className="text-right">Unlogged</TableHead>
              <TableHead>Goals</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Month sheet</TableHead>
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
                  <TableCell className="font-serif text-base">
                    {tutor}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatHours(list.reduce((sum, r) => sum + r.hours, 0))}
                  </TableCell>
                  {/* Sessions through Goals are per student; the tutor's line leaves them blank. */}
                  <TableCell colSpan={4} />
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {list.filter((r) => r.status === "sent").length}/{list.length} sent
                  </TableCell>
                  <TableCell colSpan={2} />
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
                    <TableCell className="text-right font-semibold tabular-nums">{formatHours(r.hours)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sessions}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.missed || "—"}</TableCell>
                    <TableCell
                      className="text-right text-muted-foreground tabular-nums"
                    >
                      {(r.status !== "sent" && r.unlogged.length) || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.attained.length ? (
                        <span className="tabular-nums">{r.attained.length}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <MonthStatusBadge status={r.status} className="justify-start" />
                    </TableCell>
                    <TableCell>
                      <SheetLinks
                        studentId={r.student.id}
                        name={r.student.name}
                        month={month}
                        unconfirmed={monthUnconfirmed(r)}
                      />
                    </TableCell>
                    <TableCell>
                      <SheetLinks
                        studentId={r.student.id}
                        name={r.student.name}
                        fy={fiscalYearOfMonth(month)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">
                  {rows.length === all.length ? `${monthLabel(month)} total` : "Filtered total"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatHours(filteredHours)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{filteredSessions}</TableCell>
                <TableCell colSpan={6} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
}
