"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { CURRENT_FY, useStore } from "@/lib/store";
import {
  FY_MONTHS,
  dateKey,
  daysInMonth,
  fiscalMonths,
  fiscalYearLabel,
  formatDate,
  formatHours,
} from "@/lib/fy";
import { can, visibleStudents } from "@/lib/permissions";
import { GOAL_SECTIONS } from "@/lib/goals";
import { entryIndex } from "@/lib/logic";
import { Button } from "@/components/ui/button";
import { formatDays, formatTimes, isStopped } from "../_lib/helpers";

/**
 * The paper "Student Monthly Attendance & Achievement Form", filled in from
 * the log. Letter landscape, one page, like the form it replaces.
 *
 * This is an inline <style>, not an imported stylesheet, on purpose: React
 * removes it when the sheet unmounts, so the landscape @page does not leak
 * into later prints the way global CSS imports do. Being later in the
 * document, it also outranks the portrait @page in globals.css.
 */
const PRINT_CSS = `
@media print {
  @page { size: letter landscape; margin: 0.3in; }
  .year-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; break-inside: avoid; }
}
`;

export default function SheetPage() {
  return (
    <Suspense>
      <Sheet />
    </Suspense>
  );
}

/** `?print=1` opens the print dialog once the sheet is on screen. */
function Sheet() {
  const params = useParams<{ id: string }>();
  const autoPrint = useSearchParams().get("print") === "1";
  const printed = useRef(false);
  const { db, identity, ready } = useStore();
  const months = fiscalMonths(CURRENT_FY);
  // Tutors reach only their own students' sheets; staff reach all of them.
  const student = visibleStudents(db, identity).find((s) => s.id === params.id);
  const index = entryIndex(db.entries);
  const back = can(identity, "log:view")
    ? { href: student ? `/students/${student.id}` : "/", label: "Back to the student" }
    : { href: "/reports", label: "Back to monthly reports" };

  useEffect(() => {
    if (!autoPrint || !ready || !student || printed.current) return;
    // Let the logo and fonts settle so the first print isn't missing them.
    const t = setTimeout(() => {
      printed.current = true;
      window.print();
    }, 300);
    return () => clearTimeout(t);
  }, [autoPrint, ready, student]);

  if (!ready) return null;

  if (!student) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-muted-foreground">That student sheet is not here.</p>
        <Button variant="link" nativeButton={false} render={<Link href={back.href} />}>
          {back.label}
        </Button>
      </div>
    );
  }

  const tutor = db.tutors.find((t) => t.id === student.tutorId);
  const goals = db.goals.filter((g) => g.studentId === student.id);
  const attainedOn = (code: string) =>
    goals.find((g) => g.catalogKey === code && g.attainedDate)?.attainedDate ?? null;
  const others = goals.filter((g) => g.customLabel !== undefined);
  const stopped = isStopped(student);
  const totals = months.map((month) => {
    let hours = 0;
    for (let d = 1; d <= daysInMonth(month); d++) {
      hours += index.get(`${student.id}:${dateKey(month, d)}`)?.hours ?? 0;
    }
    return hours;
  });
  const yearTotal = totals.reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={back.href} />}>
          <ArrowLeftIcon /> {back.label}
        </Button>
        <Button onClick={() => window.print()}>
          <PrinterIcon /> Print this sheet
        </Button>
      </div>

      <article className="year-sheet border border-black bg-white p-3 font-serif tracking-normal text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="grid grid-cols-[minmax(0,1fr)_260px] border border-black">
          <div className="relative border-r border-black px-3 py-1.5 text-center">
            <Image
              src="/lvaep-logo.png"
              alt="Literacy Volunteers of America, Essex/Passaic County"
              width={119}
              height={146}
              className="absolute top-1.5 left-3 h-11 w-auto"
            />
            <h1 className="text-[13px] font-bold uppercase">
              Literacy Volunteers of America, Essex/Passaic County
            </h1>
            <p className="text-[12px] font-bold">
              Student Monthly Attendance &amp; Achievement Form – {fiscalYearLabel(CURRENT_FY)}
            </p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-14 text-left text-[11px]">
              <Blank label="Tutor" value={tutor?.name ?? ""} />
              <Blank label="Student" value={student.name} />
              <Blank label="Tutoring site" value={student.site} />
              <div className="grid grid-cols-2 gap-x-4">
                <Blank label="Day(s)" value={formatDays(student.schedule)} />
                <Blank label="Time(s)" value={formatTimes(student.schedule)} />
              </div>
            </dl>
          </div>
          <address className="flex flex-col justify-center px-3 py-1.5 text-center text-[11px] not-italic">
            <p className="font-bold">Contact Information</p>
            <p className="italic">90 Broad Street, Bloomfield, NJ 07003</p>
            <p className="italic">Bloomfield Public Library</p>
            <p className="italic">info@lvaep.org -- (973) 566-6200 x216</p>
          </address>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)_320px] border-x border-b border-black">
          <section className="border-r border-black p-2">
            <h2 className="text-center text-[12px] font-bold underline">ATTENDANCE</h2>
            <p className="text-center text-[10px] italic">
              Place number of hours tutored in the appropriate box (day and month).
            </p>
            <p className="mb-1 text-center text-[9px] italic">
              (For Internal Use Only: <b>TA</b>: Tutor Absent <b>SA</b>: Student Absent{" "}
              <b>H</b>: Holiday)
            </p>
            <table className="w-full table-fixed border-collapse text-[10px] leading-none">
              <thead>
                <tr>
                  <th className="w-8 border border-black bg-neutral-100" />
                  {FY_MONTHS.map((m) => (
                    <th key={m} className="border border-black bg-neutral-100 py-0.5 font-bold">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <tr key={day}>
                    <th className="border border-black bg-neutral-100 text-center font-bold">
                      {day}
                    </th>
                    {months.map((month) => {
                      if (day > daysInMonth(month)) {
                        return <td key={month} className="border border-black bg-neutral-300" />;
                      }
                      const entry = index.get(`${student.id}:${dateKey(month, day)}`);
                      return (
                        <td key={month} className="h-[15px] border border-black text-center">
                          {entry?.code ?? (entry?.hours ? formatHours(entry.hours) : "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th className="border border-black bg-neutral-100 text-[9px] font-bold">Total</th>
                  {totals.map((total, i) => (
                    <td
                      key={months[i]}
                      className="h-[16px] border border-black bg-neutral-100 text-center font-bold"
                    >
                      {total > 0 ? formatHours(total) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
            <p className="mt-1 text-right text-[10px] font-bold">
              Year to date: {formatHours(yearTotal)} hours
            </p>
          </section>

          <section className="flex flex-col p-2 text-[11px]">
            <h2 className="text-center text-[12px] font-bold underline">ACHIEVEMENTS</h2>
            <p className="mb-1.5 text-center text-[10px] italic">
              Place a &quot;√&quot; next to each student&apos;s goal when attained.
            </p>

            {GOAL_SECTIONS.map((section) => (
              <div key={section.key} className="mb-1.5">
                <h3 className="font-bold underline">
                  {section.key}. {section.title}
                </h3>
                <ul>
                  {section.goals.map((goal, i) => (
                    <GoalRow
                      key={goal.code}
                      label={`${i + 1}. ${goal.federal ? "*" : ""}${goal.label}`}
                      attainedOn={attainedOn(goal.code)}
                    />
                  ))}
                </ul>
              </div>
            ))}

            <div className="mb-1.5">
              <h3 className="font-bold underline">E. Other(s):</h3>
              <ul>
                {others.length === 0 && <li className="h-[15px] border-b border-black" />}
                {others.map((goal) => (
                  <GoalRow
                    key={goal.id}
                    label={goal.customLabel ?? ""}
                    attainedOn={goal.attainedDate ?? null}
                  />
                ))}
              </ul>
            </div>

            <div className="mt-auto border-t border-black pt-1">
              <h3 className="text-center font-bold underline">STOPPED</h3>
              <p className="flex items-start gap-1.5">
                <Box checked={stopped} />
                <span>
                  Please place a &quot;√&quot; in the box if your student is no longer being
                  tutored and notify the office ASAP.
                  {stopped && student.stoppedDate && (
                    <span className="font-bold"> Stopped {formatDate(student.stoppedDate)}.</span>
                  )}
                </span>
              </p>
              <p className="mt-0.5 flex gap-1">
                <span className="font-bold">Reason:</span>
                <span className="flex-1 border-b border-black">{stopped ? (student.stoppedReason ?? "") : ""}</span>
              </p>
            </div>
          </section>
        </div>

        <p className="mt-2 text-center text-[9px] font-bold">
          Please consider adding extra time to all meetings, coordinating an extra session whenever
          possible, and regularly assigning homework (give your students credit for all completed
          work.)
        </p>
      </article>
    </div>
  );
}

function Blank({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 font-semibold">{label}:</dt>
      <dd className="min-w-0 flex-1 truncate border-b border-black">{value}</dd>
    </div>
  );
}

function GoalRow({ label, attainedOn }: { label: string; attainedOn: string | null }) {
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-neutral-400 py-px">
      <span>{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {attainedOn && <span className="text-[9px]">{formatDate(attainedOn)}</span>}
        <Box checked={Boolean(attainedOn)} />
      </span>
    </li>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex size-3 shrink-0 translate-y-px items-center justify-center border border-black text-[10px] leading-none">
      {checked ? "√" : ""}
    </span>
  );
}
