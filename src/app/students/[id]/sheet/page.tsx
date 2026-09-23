"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CURRENT_FY } from "@/lib/store";
import { FY_MONTHS, dateKey, daysInMonth, fiscalMonths, fiscalYearLabel, formatHours } from "@/lib/fy";
import { entryIndex } from "@/lib/logic";
import {
  AchievementsList,
  FormFooter,
  FormHeader,
  PrintStyle,
  SheetMissing,
  SheetToolbar,
  StoppedBox,
  useSheetStudent,
} from "./_components/SheetParts";

/**
 * The paper "Student Monthly Attendance & Achievement Form", filled in from
 * the log for one fiscal year (`?fy=`, else the current one). Letter
 * landscape, one page, like the form it replaces. Each month's heading opens
 * that month's sheet. A past year shows goals and the stopped box as they
 * stood when it ended.
 */
export default function SheetPage() {
  return (
    <Suspense>
      <Sheet />
    </Suspense>
  );
}

function Sheet() {
  const { db, ready, student, back } = useSheetStudent();
  // `?fy=2025` shows FY 2025–26; without it, the current fiscal year.
  const asked = Number(useSearchParams().get("fy"));
  const fy = Number.isInteger(asked) && asked > 2000 ? asked : CURRENT_FY;
  const months = fiscalMonths(fy);

  if (!ready) return null;
  if (!student) return <SheetMissing back={back} />;

  const index = entryIndex(db.entries);
  const tutor = db.tutors.find((t) => t.id === student.tutorId);
  const totals = months.map((month) => {
    let hours = 0;
    for (let d = 1; d <= daysInMonth(month); d++) {
      hours += index.get(`${student.id}:${dateKey(month, d)}`)?.hours ?? 0;
    }
    return hours;
  });
  const yearTotal = totals.reduce((a, b) => a + b, 0);
  const past = fy < CURRENT_FY;
  const yearEnd = past ? `${fy + 1}-06-30` : undefined;

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-6 print:max-w-none print:p-0">
      <PrintStyle orientation="landscape" />
      <SheetToolbar back={back} />

      <article className="paper-sheet border border-black bg-white p-3 font-serif tracking-normal text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
        <FormHeader
          student={student}
          tutorName={tutor?.name ?? ""}
          title={`Student Monthly Attendance & Achievement Form – ${fiscalYearLabel(fy)}`}
        />

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
                  {FY_MONTHS.map((m, i) => (
                    <th key={m} className="border border-black bg-neutral-100 py-0.5 font-bold">
                      {/* A link on screen, plain text on paper. */}
                      <Link
                        href={`/students/${student.id}/sheet/${months[i]}`}
                        className="underline decoration-neutral-400 underline-offset-2 hover:decoration-black print:no-underline"
                        aria-label={`Open the ${m} month sheet`}
                      >
                        {m}
                      </Link>
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
              {past ? "Year total" : "Year to date"}: {formatHours(yearTotal)} hours
            </p>
          </section>

          <section className="flex flex-col p-2 text-[11px]">
            <h2 className="text-center text-[12px] font-bold underline">ACHIEVEMENTS</h2>
            <p className="mb-1.5 text-center text-[10px] italic">
              Place a &quot;√&quot; next to each student&apos;s goal when attained.
            </p>
            <AchievementsList
              goals={db.goals.filter((g) => g.studentId === student.id)}
              asOf={yearEnd}
            />
            <div className="mt-auto">
              <StoppedBox student={student} asOf={yearEnd} />
            </div>
          </section>
        </div>

        <FormFooter />
      </article>
    </div>
  );
}
