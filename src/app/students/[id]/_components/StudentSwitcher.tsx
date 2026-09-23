"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react";
import type { Student } from "@/lib/types";
import { Button } from "@/components/ui/button";

/**
 * A link to every student and group, then previous / next student. Stepping
 * follows the list's order and wraps around at either end, so the last
 * student's "next" is the first.
 */
export function StudentSwitcher({ students, activeId }: { students: Student[]; activeId: string }) {
  const at = students.findIndex((s) => s.id === activeId);
  const n = students.length;
  const stepping = at !== -1 && n > 1;

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/students/all" />}>
        <UsersIcon /> See all students and groups
      </Button>
      {stepping && <Stepper students={students} at={at} />}
    </div>
  );
}

function Stepper({ students, at }: { students: Student[]; at: number }) {
  const n = students.length;
  const prev = students[(at - 1 + n) % n];
  const next = students[(at + 1) % n];

  return (
    <nav aria-label="Step through students" className="flex items-center gap-1">
      <StepButton student={prev} label="Previous student">
        <ChevronLeftIcon />
      </StepButton>
      <span className="min-w-[3.5rem] text-center text-xs text-muted-foreground tabular-nums">
        {at + 1} of {n}
      </span>
      <StepButton student={next} label="Next student">
        <ChevronRightIcon />
      </StepButton>
    </nav>
  );
}

function StepButton({
  student,
  label,
  children,
}: {
  student: Student;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      nativeButton={false}
      aria-label={`${label}: ${student.name}`}
      title={student.name}
      render={<Link href={`/students/${student.id}`} />}
    >
      {children}
    </Button>
  );
}
