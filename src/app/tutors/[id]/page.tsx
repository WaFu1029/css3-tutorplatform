"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, CalendarDaysIcon, FileTextIcon } from "lucide-react";
import { cn } from "cn";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalMonths, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StudentsCalendar, type Selection } from "@/app/_components/StudentsCalendar";
import { StaffReports } from "@/app/reports/_components/StaffReports";
import { ReadOnlyDay } from "../_components/ReadOnlyDay";
import { tutorStats } from "../_components/tutorStats";

type View = "calendar" | "reports";

/**
 * One tutor, as staff see them: their students' calendar with a read-only
 * day panel, and the Monthly reports view narrowed to them. The month is
 * shared, so switching views keeps your place.
 */
export default function TutorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { db, ready } = useStore();
  const months = useMemo(() => fiscalMonths(CURRENT_FY), []);
  const today = todayISO();
  const [view, setView] = useState<View>("calendar");
  // Reports can go back to earlier fiscal years; the calendar stays on this one.
  const [reportMonth, setReportMonth] = useState(() => monthKey(today));
  const [month, setMonth] = useState(() =>
    months.includes(monthKey(today)) ? monthKey(today) : months[0],
  );
  const [selected, setSelected] = useState<Selection>({ date: today, studentId: null });

  const tutor = db.tutors.find((t) => t.id === id);
  const students = useMemo(() => db.students.filter((s) => s.tutorId === id), [db.students, id]);

  if (!ready) return null;

  if (!tutor) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <Empty className="rounded-xl bg-card">
          <EmptyHeader>
            <EmptyTitle>No such tutor</EmptyTitle>
            <EmptyDescription>The link may be out of date.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" nativeButton={false} render={<Link href="/tutors" />}>
              Back to tutors
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const stats = tutorStats(db, tutor, month);

  return (
    <div className="mx-auto max-w-[1560px] space-y-6 px-5 py-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={<Link href="/tutors" />}
        >
          <ArrowLeftIcon /> All tutors
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-tight tracking-tight">{tutor.name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <a href={`mailto:${tutor.email}`} className="underline decoration-border underline-offset-2 hover:decoration-foreground">
                {tutor.email}
              </a>
              {" · "}
              {stats.active} active student{stats.active === 1 ? "" : "s"}
              {stats.sites.length > 0 && ` · ${stats.sites.join(", ")}`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {monthLabel(month)}: {formatHours(stats.hours)} hours · {stats.sessions} sessions ·{" "}
              {stats.sent}/{stats.reportable} confirmed
              {stats.unlogged > 0 && ` · ${stats.unlogged} unlogged`}
            </p>
          </div>

          <div role="tablist" aria-label="View" className="flex gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { key: "calendar", label: "Calendar", icon: CalendarDaysIcon },
                { key: "reports", label: "Reports", icon: FileTextIcon },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === key ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
          <StudentsCalendar
            students={students}
            months={months}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(next) => {
              setSelected(next);
              if (months.includes(monthKey(next.date))) setMonth(monthKey(next.date));
            }}
          />
          <div className="lg:sticky lg:top-[68px]">
            <ReadOnlyDay students={students} selected={selected} />
          </div>
        </div>
      ) : (
        <StaffReports month={reportMonth} onMonth={setReportMonth} lockTutorId={tutor.id} />
      )}
    </div>
  );
}
