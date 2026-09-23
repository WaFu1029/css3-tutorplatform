"use client";

import type { DB, Student } from "@/lib/types";
import { StudentSidebar } from "@/components/StudentSidebar";

/**
 * @deprecated Use StudentSidebar, which links to each student's page itself.
 * Kept so pages written against the old props keep working.
 */
export function StudentRail({
  students,
  activeId,
}: {
  students: Student[];
  db?: DB;
  activeId: string;
  onPick?: (id: string) => void;
}) {
  return <StudentSidebar students={students} activeId={activeId} />;
}
