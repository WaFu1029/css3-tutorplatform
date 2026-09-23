"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { tutorStats } from "./_components/tutorStats";

/**
 * The Tutors tab, for staff: every tutor with this month at a glance. Each
 * opens a profile with their calendar and their reports. RouteGuard keeps
 * tutors out (tutors:view in lib/permissions).
 */
export default function TutorsPage() {
  const { db, ready } = useStore();
  const month = monthKey(todayISO());
  if (!ready) return null;

  const tutors = [...db.tutors].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
      <div>
        <h1 className="font-serif text-4xl leading-tight tracking-tight">Tutors</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tutors.length} tutor{tutors.length === 1 ? "" : "s"} · {monthLabel(month)} so far. Open one
          to see their calendar and reports.
        </p>
      </div>

      <ul className="space-y-2">
        {tutors.map((tutor) => {
          const s = tutorStats(db, tutor, month);
          return (
            <li key={tutor.id}>
              <Link
                href={`/tutors/${tutor.id}`}
                className="group flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-card px-5 py-4 transition-colors hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="min-w-[12rem] flex-1">
                  <p className="font-medium">{tutor.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.active} active student{s.active === 1 ? "" : "s"}
                    {s.students > s.active && ` · ${s.students - s.active} stopped`}
                    {s.sites.length > 0 && ` · ${s.sites.join(", ")}`}
                  </p>
                </div>
                <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                  <Stat label="Hours" value={formatHours(s.hours)} accent />
                  <Stat label="Sessions" value={String(s.sessions)} />
                  <Stat label="Confirmed" value={`${s.sent}/${s.reportable}`} />
                  {s.unlogged > 0 && <Stat label="Unlogged" value={String(s.unlogged)} />}
                  {s.stoppedThisMonth > 0 && (
                    <Stat label="Stopped" value={String(s.stoppedThisMonth)} warn />
                  )}
                </dl>
                <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-lg font-semibold tabular-nums ${accent ? "text-primary" : ""} ${warn ? "text-destructive" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
