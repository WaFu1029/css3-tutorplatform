"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UsersIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { can, visibleStudents } from "@/lib/permissions";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * The Students tab opens straight onto the first student's page; the arrows
 * there step through the rest. Tutor-only; RouteGuard sends staff to reports.
 */
export default function StudentsPage() {
  const { db, identity, ready } = useStore();
  const router = useRouter();
  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const first = students.find((s) => s.status === "active") ?? students[0];

  useEffect(() => {
    if (ready && first) router.replace(`/students/${first.id}`);
  }, [ready, first, router]);

  // Until the saved session loads the seed is showing, and with students the
  // redirect above takes over.
  if (!ready || first) return null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <Empty className="rounded-xl bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>No students yet</EmptyTitle>
          <EmptyDescription>Once a student is assigned to you, they show up here.</EmptyDescription>
        </EmptyHeader>
        {can(identity, "students:manage") && (
          <EmptyContent>
            <AddStudentDialog />
          </EmptyContent>
        )}
      </Empty>
    </div>
  );
}
