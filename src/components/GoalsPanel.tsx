"use client";

import type { Student } from "@/lib/types";
import { GoalsColumn } from "@/components/GoalsColumn";

/** @deprecated Use GoalsColumn. Kept so pages written against it keep working. */
export function GoalsPanel({ student }: { student: Student }) {
  return <GoalsColumn students={[student]} />;
}
