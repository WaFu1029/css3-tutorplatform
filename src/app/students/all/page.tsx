"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { can, visibleStudents } from "@/lib/permissions";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { GroupsPanel } from "@/components/GroupsPanel";
import { StudentSidebar } from "@/components/StudentSidebar";
import { Button } from "@/components/ui/button";

/**
 * Every student and group the tutor has. A student opens their page; a group
 * opens its details to edit. Reached from "See all students and groups" on a
 * student's page. Tutor-only: RouteGuard sends staff to reports.
 */
export default function AllStudentsPage() {
  const { db, identity, ready } = useStore();
  const students = useMemo(() => visibleStudents(db, identity), [db, identity]);
  const manage = can(identity, "students:manage");

  // Until the saved session loads, the seed is showing.
  if (!ready) return null;

  // Active students first, then those who've stopped.
  const ordered = [
    ...students.filter((s) => s.status === "active"),
    ...students.filter((s) => s.status !== "active"),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-5 py-6">
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={<Link href="/students" />}
        >
          <ArrowLeftIcon /> Back to student pages
        </Button>
        <h1 className="font-serif text-4xl leading-tight tracking-tight">Students and groups</h1>
        <StudentSidebar
          students={ordered}
          showStatus
          action={manage ? <AddStudentDialog size="sm" /> : undefined}
        />
        {ordered.length === 0 && <p className="text-sm text-muted-foreground">No students yet.</p>}
      </div>

      {identity.role === "tutor" && (
        <GroupsPanel
          tutorId={identity.tutorId}
          students={students.filter((s) => s.status === "active")}
        />
      )}
    </div>
  );
}
