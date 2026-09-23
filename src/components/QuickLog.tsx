"use client";

import type { Student } from "@/lib/types";
import { LoggingBar } from "@/components/LoggingBar";

/**
 * @deprecated Use LoggingBar with `preselectedStudentId`. Kept so pages
 * written against the old component keep working until they switch.
 */
export function QuickLog({
  students,
  activeStudentId,
}: {
  students: Student[];
  activeStudentId: string;
  onPickStudent?: (id: string) => void;
}) {
  // Keyed on the student so moving between student pages starts a fresh bar.
  return <LoggingBar key={activeStudentId} students={students} preselectedStudentId={activeStudentId} />;
}
