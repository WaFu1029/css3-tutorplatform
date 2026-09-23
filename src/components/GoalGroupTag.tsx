"use client";

import { UsersIcon } from "lucide-react";
import { cn } from "cn";
import type { Goal } from "@/lib/types";
import { goalGroups } from "@/lib/logic";
import { useStore } from "@/lib/store";

/** "From Citizenship circle" on a goal the student's group shares; nothing otherwise. */
export function GoalGroupTag({ goal, className }: { goal: Goal; className?: string }) {
  const { db } = useStore();
  const groups = goalGroups(goal, db.groups);
  if (groups.length === 0) return null;
  const names = groups.map((g) => g.name).join(", ");
  return (
    <span
      title={`A shared goal of ${names}`}
      className={cn(
        "inline-flex max-w-full items-start gap-1 rounded-sm bg-sky-100 px-1.5 py-px text-[11px] font-medium text-sky-900",
        className,
      )}
    >
      <UsersIcon className="mt-px size-3 shrink-0" />
      <span>From {names}</span>
    </span>
  );
}
