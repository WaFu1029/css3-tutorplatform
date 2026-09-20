"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { CURRENT_FY, entryIndex, useStore } from "@/lib/store";
import {
  FY_MONTHS,
  dateKey,
  daysInMonth,
  fiscalMonths,
  fiscalYearLabel,
  formatDate,
  formatHours,
} from "@/lib/fy";
import { GOAL_SECTIONS } from "@/lib/goals";
import { Button } from "@/components/ui/button";

export default function SheetPage() {
  const params = useParams<{ id: string }>();
  const { db } = useStore();
  const months = fiscalMonths(CURRENT_FY);
  const student = db.students.find((s) => s.id === params.id);
  const index = entryIndex(db.entries);

  if (!student) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-muted-foreground">That student sheet is not here.</p>
        <Button variant="link" nativeButton={false}
                render={<Link href="/reports" />}>
          Back to monthly reports
        </Button>
      </div>
    );
  }

  const tutor = db.tutors.find((t) => t.id === student.tutorId);
  const totals = months.map((month) => {
    let hours = 0;
    for (let d = 1; d <= daysInMonth(month); d++) {
      hours += index.get(`${student.id}:${dateKey(month, d)}`)?.hours ?? 0;
    }
    return hours;
  });
  const yearTotal = totals.reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" nativeButton={false}
                render={<Link href="/" />}>
          <ArrowLeftIcon /> Back to the log
        </Button>
        <Button onClick={() => window.print()}>
          <PrinterIcon /> Print this sheet
        </Button>
      </div>

      <article className="sheet border border-black bg-white p-4 font-serif tracking-normal text-black shadow-sm print:border-0 print:shadow-none">
        <header className="grid grid-cols-[minmax(0,1fr)_260px] border border-black">
          <div className="relative border-r border-black px-3 py-2 text-center">
            <Image
              src="/lvaep-logo.png"
              alt="Literacy Volunteers of America, Essex/Passaic County"
              width={119}
              height={146}
              className="absolute top-2 left-3 h-12 w-auto"
            />
            <h1 className="text-[13px] font-bold uppercase">
              Literacy Volunteers of America, Essex/Passaic County
            </h1>
            <p className="text-[12px] font-bold">
              Student Monthly Attendance &amp; Achievement Form — {fiscalYearLabel(CURRENT_FY)}
            </p>
            <dl className="mt-2 flex justify-around text-[12px]">
              <div className="flex gap-2">
                <dt className="font-semibold">Tutor:</dt>
                <dd className="min-w-[160px] border-b border-black text-left">
                  {tutor?.name}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Student:</dt>
                <dd className="min-w-[160px] border-b border-black text-left">{student.name}</dd>
              </div>
            </dl>
          </div>
          <address className="px-3 py-2 text-center text-[11px] not-italic">
            <p className="font-bold">Contact information</p>
            <p className="italic">90 Broad Street, Bloomfield, NJ 07003</p>
            <p className="italic">Bloomfield Public Library</p>
            <p className="italic">info@lvaep.org · (973) 566-6200 x216</p>
          </address>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)_320px] border-x border-b border-black">
          <section className="border-r border-black p-2">
            <h2 className="text-center text-[12px] font-bold underline">Attendance</h2>
            <p className="mb-2 text-center text-[10px] italic">
              Hours tutored by day and month. T: tutor absent · S: student absent · H: holiday
            </p>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="w-7 border border-black bg-neutral-100" />
                  {FY_MONTHS.map((m) => (
                    <th key={m} className="border border-black bg-neutral-100 px-0.5 font-bold">
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
                        return <td key={month} className="border border-black bg-neutral-200" />;
                      }
                      const entry = index.get(`${student.id}:${dateKey(month, day)}`);
                      return (
                        <td key={month} className="h-[15px] border border-black text-center">
                          {entry?.code ?? (entry && entry.hours > 0 ? formatHours(entry.hours) : "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th className="border border-black bg-neutral-100 text-[9px] font-bold">Tot</th>
                  {totals.map((total, i) => (
                    <td
                      key={months[i]}
                      className="border border-black bg-neutral-100 text-center font-bold"
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

          <section className="p-2 text-[11px]">
            <h2 className="text-center text-[12px] font-bold underline">Achievements</h2>
            <p className="mb-2 text-center text-[10px] italic">
              A check marks each goal the student has attained.
            </p>

            {GOAL_SECTIONS.map((section) => (
              <div key={section.key} className="mb-2">
                <h3 className="border-b border-black font-bold underline">
                  {section.key}. {section.title}
                </h3>
                <ul>
                  {section.goals.map((goal, i) => {
                    const mark = student.goals[goal.code];
                    return (
                      <li
                        key={goal.code}
                        className="flex items-baseline justify-between gap-2 border-b border-neutral-300 py-[1px]"
                      >
                        <span>
                          {i + 1}. {goal.federal ? "*" : ""}
                          {goal.label}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {mark && (
                            <span className="text-[9px]">{formatDate(mark.attainedOn)}</span>
                          )}
                          <span className="inline-flex h-3 w-3 items-center justify-center border border-black text-[10px] leading-none">
                            {mark ? "✓" : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div className="mb-2">
              <h3 className="border-b border-black font-bold underline">E. Other(s)</h3>
              <ul>
                {student.otherGoals.length === 0 && (
                  <li className="border-b border-neutral-300 py-[1px] text-neutral-400">—</li>
                )}
                {student.otherGoals.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex items-baseline justify-between gap-2 border-b border-neutral-300 py-[1px]"
                  >
                    <span>{goal.label}</span>
                    <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center border border-black text-[10px] leading-none">
                      {goal.attainedOn ? "✓" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-center font-bold underline">Stopped</h3>
              <p className="flex items-baseline gap-2">
                <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center border border-black text-[10px] leading-none">
                  {student.stopped ? "✓" : ""}
                </span>
                <span>
                  {student.stopped
                    ? `No longer tutored as of ${formatDate(student.stopped.on)}.`
                    : "Checked when the student is no longer being tutored."}
                </span>
              </p>
              <p className="mt-1">
                <span className="font-bold">Reason:</span>{" "}
                <span className="border-b border-black">{student.stopped?.reason ?? ""}</span>
              </p>
            </div>
          </section>
        </div>

        <footer className="grid grid-cols-3 border-x border-b border-black text-[11px]">
          <p className="border-r border-black px-2 py-1">
            <span className="font-bold">Tutoring site:</span> {student.site}
          </p>
          <p className="border-r border-black px-2 py-1">
            <span className="font-bold">Day(s):</span> {student.days}
          </p>
          <p className="px-2 py-1">
            <span className="font-bold">Time(s):</span> {student.times}
          </p>
        </footer>
      </article>
    </div>
  );
}
