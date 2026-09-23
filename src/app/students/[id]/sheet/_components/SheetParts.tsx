"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import type { Goal, Student } from "@/lib/types";
import { formatDate } from "@/lib/fy";
import { GOAL_SECTIONS } from "@/lib/goals";
import { can, visibleStudents } from "@/lib/permissions";
import { currentSlots, formatDays, formatTimes } from "@/lib/schedule";
import { SITES } from "@/lib/sites";
import { useStore } from "@/lib/store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/*
 * The pieces the printable year and month sheets share, so both read as the
 * same paper form.
 */

/**
 * An inline <style>, not an imported stylesheet, on purpose: React removes
 * it when the sheet unmounts, so the @page size does not leak into later
 * prints the way global CSS imports do. Being later in the document, it
 * also outranks the portrait @page in globals.css.
 */
export function PrintStyle({ orientation }: { orientation: "portrait" | "landscape" }) {
  return (
    <style>{`
@media print {
  @page { size: letter ${orientation}; margin: 0.3in; }
  .paper-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; break-inside: avoid; }
}
`}</style>
  );
}

/**
 * The student a sheet is for, if this identity may see them (tutors their
 * own, staff everyone), plus where "back" goes. `?print=1` opens the print
 * dialog once the sheet is on screen.
 */
export function useSheetStudent() {
  const params = useParams<{ id: string }>();
  const autoPrint = useSearchParams().get("print") === "1";
  const printed = useRef(false);
  const { db, identity, ready } = useStore();
  const student = visibleStudents(db, identity).find((s) => s.id === params.id);
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

  return { db, ready, student, back };
}

export function SheetMissing({ back }: { back: { href: string; label: string } }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center">
      <p className="text-muted-foreground">That student sheet is not here.</p>
      <Button variant="link" nativeButton={false} render={<Link href={back.href} />}>
        {back.label}
      </Button>
    </div>
  );
}

export function SheetToolbar({
  back,
  children,
}: {
  back: { href: string; label: string };
  /** Extra controls between back and print, e.g. month paging. */
  children?: React.ReactNode;
}) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={back.href} />}>
        <ArrowLeftIcon /> {back.label}
      </Button>
      {children}
      <Button onClick={() => window.print()}>
        <PrinterIcon /> Print this sheet
      </Button>
    </div>
  );
}

/** Logo, form title, the tutor/student/site/day/time blanks, and the contact block. */
export function FormHeader({
  student,
  tutorName,
  title,
}: {
  student: Student;
  tutorName: string;
  title: string;
}) {
  const slots = currentSlots(student.schedule);
  return (
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
        <p className="text-[12px] font-bold">{title}</p>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-14 text-left text-[11px]">
          <Blank label="Tutor" value={tutorName} />
          <Blank label="Student" value={student.name} />
          <Blank label="Day(s)" value={formatDays(slots)} />
          <Blank label="Time(s)" value={formatTimes(slots)} />
          <div className="col-span-2">
            <Blank label="Tutoring site" value={student.site} />
          </div>
        </dl>
      </div>
      <address className="flex flex-col justify-center gap-1 px-3 py-1.5 text-center text-[10px] leading-tight not-italic">
        <p className="text-[11px] font-bold">Contact Information</p>
        {SITES.map((site) => (
          <div key={site.name}>
            <p className="font-semibold">{site.name}</p>
            <p className="italic">{site.address}</p>
            <p className="italic">{site.phone}</p>
          </div>
        ))}
        <p className="italic">info@lvaep.org</p>
      </address>
    </header>
  );
}

/**
 * The catalog with attained goals ticked and custom goals under "Other(s)".
 * `asOf` limits ticks to goals attained on or before that date (a month
 * sheet shows the month as it ended); `highlightFrom` marks goals attained
 * on or after it, i.e. during that month.
 */
export function AchievementsList({
  goals,
  asOf,
  highlightFrom,
  columns = 1,
}: {
  goals: Goal[];
  asOf?: string;
  highlightFrom?: string;
  columns?: 1 | 2;
}) {
  const counted = (d: string | undefined) => (d && (!asOf || d <= asOf) ? d : null);
  const attainedOn = (code: string) =>
    counted(goals.find((g) => g.catalogKey === code && g.attainedDate)?.attainedDate);
  const others = goals.filter((g) => g.customLabel !== undefined);
  const fresh = (d: string | null) => Boolean(d && highlightFrom && d >= highlightFrom);

  const dense = columns === 2;
  const section = (key: string) => {
    const sec = GOAL_SECTIONS.find((s) => s.key === key)!;
    return (
      <div key={sec.key} className={dense ? "mb-1" : "mb-1.5"}>
        <h3 className="font-bold underline">
          {sec.key}. {sec.title}
        </h3>
        <ul>
          {sec.goals.map((goal, i) => {
            const on = attainedOn(goal.code);
            return (
              <GoalRow
                key={goal.code}
                label={`${i + 1}. ${goal.federal ? "*" : ""}${goal.label}`}
                attainedOn={on}
                fresh={fresh(on)}
                dense={dense}
              />
            );
          })}
        </ul>
      </div>
    );
  };
  const other = (
    <div key="E" className={dense ? "mb-1" : "mb-1.5"}>
      <h3 className="font-bold underline">E. Other(s):</h3>
      <ul>
        {others.length === 0 && <li className="h-[15px] border-b border-black" />}
        {others.map((goal) => {
          const on = counted(goal.attainedDate);
          return (
            <GoalRow
              key={goal.id}
              label={goal.customLabel ?? ""}
              attainedOn={on}
              fresh={fresh(on)}
              dense={dense}
            />
          );
        })}
      </ul>
    </div>
  );

  if (!dense) return <div>{[...GOAL_SECTIONS.map((s) => section(s.key)), other]}</div>;

  // Two columns set by hand, A–B–E beside C–D, which balances the rows
  // (3 + 4 + others against 6 + 4) better than letting CSS columns choose.
  return (
    <div className="grid grid-cols-2 gap-x-4 text-[10px] leading-tight">
      <div>
        {section("A")}
        {section("B")}
        {other}
      </div>
      <div>
        {section("C")}
        {section("D")}
      </div>
    </div>
  );
}

/** The form's STOPPED box. `asOf` leaves it unticked for a stop after that date. */
export function StoppedBox({ student, asOf }: { student: Student; asOf?: string }) {
  const stopped =
    student.status === "stopped" && (!asOf || !student.stoppedDate || student.stoppedDate <= asOf);
  return (
    <div className="border-t border-black pt-1">
      <h3 className="text-center font-bold underline">STOPPED</h3>
      <p className="flex items-start gap-1.5">
        <Box checked={stopped} />
        <span>
          Please place a &quot;√&quot; in the box if your student is no longer being tutored and
          notify the office ASAP.
          {stopped && student.stoppedDate && (
            <span className="font-bold"> Stopped {formatDate(student.stoppedDate)}.</span>
          )}
        </span>
      </p>
      <p className="mt-0.5 flex gap-1">
        <span className="font-bold">Reason:</span>
        <span className="flex-1 border-b border-black">
          {stopped ? (student.stoppedReason ?? "") : ""}
        </span>
      </p>
    </div>
  );
}

export function FormFooter() {
  return (
    <p className="mt-2 text-center text-[9px] font-bold">
      Please consider adding extra time to all meetings, coordinating an extra session whenever
      possible, and regularly assigning homework (give your students credit for all completed
      work.)
    </p>
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

function GoalRow({
  label,
  attainedOn,
  fresh,
  dense,
}: {
  label: string;
  attainedOn: string | null;
  /** Attained during the month the sheet covers. */
  fresh?: boolean;
  dense?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-baseline justify-between gap-2 border-b border-neutral-400",
        dense ? "py-0" : "py-px",
      )}
    >
      <span className={fresh ? "font-bold" : undefined}>{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {attainedOn && <span className="text-[9px]">{formatDate(attainedOn)}</span>}
        <Box checked={Boolean(attainedOn)} />
      </span>
    </li>
  );
}

export function Box({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex size-3 shrink-0 translate-y-px items-center justify-center border border-black text-[10px] leading-none">
      {checked ? "√" : ""}
    </span>
  );
}
