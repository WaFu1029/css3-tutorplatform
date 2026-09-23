"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { CURRENT_FY } from "@/lib/store";
import { ABSENCE_LABEL } from "@/lib/absence";
import {
  dateKey,
  daysInMonth,
  fiscalMonths,
  formatDate,
  formatHours,
  monthLabel,
  todayISO,
  weekdayOf,
} from "@/lib/fy";
import { entryIndex, ledgerOf, monthSummary, reportFor, slotsOn } from "@/lib/logic";
import { formatSlotTime, WEEKDAY_SHORT } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import {
  AchievementsList,
  FormFooter,
  FormHeader,
  PrintStyle,
  SheetMissing,
  SheetToolbar,
  StoppedBox,
  useSheetStudent,
} from "../_components/SheetParts";

/**
 * One month of the paper form: every day with what was scheduled, what was
 * logged and the tutor's note, the month's totals, and the achievement list
 * as it stood at the end of the month. Letter portrait, one page.
 */
export default function MonthSheetPage() {
  return (
    <Suspense>
      <MonthSheet />
    </Suspense>
  );
}

function MonthSheet() {
  const { month } = useParams<{ month: string }>();
  const { db, ready, student, back } = useSheetStudent();
  // Paging stays inside the fiscal year this month belongs to.
  const fy = /^\d{4}-\d{2}$/.test(month)
    ? Number(month.slice(5)) >= 7
      ? Number(month.slice(0, 4))
      : Number(month.slice(0, 4)) - 1
    : CURRENT_FY;
  const months = fiscalMonths(fy);

  if (!ready) return null;
  if (!student || !/^\d{4}-\d{2}$/.test(month)) return <SheetMissing back={back} />;

  const index = entryIndex(db.entries);
  const tutor = db.tutors.find((t) => t.id === student.tutorId);
  const today = todayISO();
  const ledger = ledgerOf(db);
  const summary = monthSummary(student, month, ledger, today);
  const unlogged = new Set(summary.unlogged);
  const report = reportFor(db.reports, student.id, month);
  const monthEnd = dateKey(month, daysInMonth(month));
  const at = months.indexOf(month);
  const sheetHref = (m: string) => `/students/${student.id}/sheet/${m}`;

  return (
    <div className="mx-auto max-w-[820px] px-5 py-6 print:max-w-none print:p-0">
      <PrintStyle orientation="portrait" />
      <SheetToolbar back={back}>
        <nav aria-label="Other sheets" className="flex items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            disabled={at <= 0}
            nativeButton={false}
            render={<Link href={at > 0 ? sheetHref(months[at - 1]) : "#"} />}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-[8.5rem] text-center font-medium">{monthLabel(month)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={at === -1 || at >= months.length - 1}
            nativeButton={false}
            render={
              <Link href={at !== -1 && at < months.length - 1 ? sheetHref(months[at + 1]) : "#"} />
            }
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="link"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`/students/${student.id}/sheet${fy === CURRENT_FY ? "" : `?fy=${fy}`}`}
              />
            }
          >
            Year sheet
          </Button>
        </nav>
      </SheetToolbar>

      <article className="paper-sheet border border-black bg-white p-3 font-serif tracking-normal text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
        <FormHeader
          student={student}
          tutorName={tutor?.name ?? ""}
          title={`Student Monthly Attendance & Achievement Form – ${monthLabel(month)}`}
        />

        <section className="border-x border-b border-black p-2">
          <h2 className="text-center text-[12px] font-bold underline">ATTENDANCE</h2>
          <p className="mb-1 text-center text-[9px] italic">
            (For Internal Use Only: <b>TA</b>: Tutor Absent <b>SA</b>: Student Absent{" "}
            <b>H</b>: Holiday)
          </p>
          <table className="w-full table-fixed border-collapse text-[10px] leading-none">
            <thead>
              <tr className="bg-neutral-100">
                <th className="w-14 border border-black px-1 py-0.5 text-left">Date</th>
                <th className="w-44 border border-black px-1 py-0.5 text-left">Scheduled</th>
                <th className="w-16 border border-black px-1 py-0.5 text-center">Hours</th>
                <th className="border border-black px-1 py-0.5 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((day) => {
                const date = dateKey(month, day);
                const weekday = weekdayOf(date);
                const entry = index.get(`${student.id}:${date}`);
                const slot = slotsOn(student, date, db.groups)[0];
                const weekend = weekday === 0 || weekday === 6;
                return (
                  <tr key={date} className={cn(weekend && "bg-neutral-50")}>
                    <td className="h-[14px] border border-black px-1 py-px tabular-nums">
                      {WEEKDAY_SHORT[weekday]} {day}
                    </td>
                    <td className="truncate border border-black px-1">
                      {slot
                        ? `${formatSlotTime(slot.slot)}${slot.group ? ` · ${slot.group.name}` : ""}`
                        : ""}
                    </td>
                    <td className="border border-black px-1 text-center">
                      {entry?.code ? (
                        <span title={ABSENCE_LABEL[entry.code]}>{entry.code}</span>
                      ) : entry?.hours ? (
                        <b>{formatHours(entry.hours)}</b>
                      ) : unlogged.has(date) ? (
                        <span className="text-neutral-500 italic">not logged</span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="border border-black px-1">{entry?.note ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-100 font-bold">
                <td className="border border-black px-1">Total</td>
                <td className="border border-black px-1 font-normal">
                  {summary.sessions} session{summary.sessions === 1 ? "" : "s"} · {summary.missed}{" "}
                  missed
                </td>
                <td className="border border-black px-1 text-center">
                  {formatHours(summary.hours)} h
                </td>
                <td className="border border-black px-1 font-normal">
                  {report?.status === "sent"
                    ? `Confirmed by the tutor${report.sentAt ? ` ${formatDate(report.sentAt.slice(0, 10))}` : ""}.`
                    : "Not yet confirmed by the tutor."}
                  {summary.unlogged.length > 0 &&
                    ` ${summary.unlogged.length} scheduled day${summary.unlogged.length === 1 ? "" : "s"} not logged.`}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="border-x border-b border-black p-2 text-[11px]">
          <h2 className="text-center text-[12px] font-bold underline">ACHIEVEMENTS</h2>
          <p className="mb-1.5 text-center text-[10px] italic">
            Goals attained by {formatDate(monthEnd)} are checked; those attained in{" "}
            {monthLabel(month).split(" ")[0]} are in bold.
          </p>
          <AchievementsList
            goals={db.goals.filter((g) => g.studentId === student.id)}
            asOf={monthEnd}
            highlightFrom={dateKey(month, 1)}
            columns={2}
          />
          <StoppedBox student={student} asOf={monthEnd} />
        </section>

        <FormFooter />
      </article>
    </div>
  );
}
