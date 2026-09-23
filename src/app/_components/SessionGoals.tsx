"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import type { Goal, Student } from "@/lib/types";
import { goalStage, goalText, isStarred } from "@/lib/goals";
import { formatDate, todayISO } from "@/lib/fy";
import { entryOn } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { GoalGroupTag } from "@/components/GoalGroupTag";

/**
 * Goal progress from the session itself. Only open goals are listed, in
 * progress first, then not started; attained ones drop off (the toast's Undo
 * brings one back). Each move is stamped with the session's date.
 */
export function SessionGoals({ student, date }: { student: Student; date: string }) {
  const { db, setGoalStage, restoreGoal } = useStore();
  const goals = db.goals.filter((g) => g.studentId === student.id);
  const doing = goals.filter((g) => goalStage(g) === "doing");
  const todo = goals.filter((g) => goalStage(g) === "todo");
  const future = date > todayISO();
  // Goal progress is recorded against a session, so the day's hours or
  // TA/SA/H have to be logged first.
  const logged = Boolean(entryOn(db.entries, student.id, date));

  function move(goal: Goal, next: "doing" | "done") {
    setGoalStage(goal.id, next, date);
    toast.success(`${next === "done" ? "Attained" : "Started"}: ${goalText(goal)}`, {
      description: `${student.name.split(" ")[0]} · ${formatDate(date)}`,
      action: { label: "Undo", onClick: () => restoreGoal(goal) },
    });
  }

  function group(title: string, list: Goal[]) {
    if (list.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        <ul className="space-y-1.5">
          {list.map((goal) => {
            const started = goalStage(goal) === "doing";
            return (
              <li key={goal.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="min-w-[10rem] flex-1 text-sm leading-snug">
                  {goalText(goal)}
                  {isStarred(goal) && <span className="text-primary">*</span>}
                  {started && goal.startedDate && (
                    <span className="block text-xs text-muted-foreground">
                      Started {formatDate(goal.startedDate)}
                    </span>
                  )}
                  <GoalGroupTag goal={goal} className="mt-0.5 flex w-fit" />
                </span>
                {!future && (
                  <span className="flex shrink-0 gap-1">
                    {!started && (
                      <Button
                        size="xs"
                        variant="outline"
                        aria-label={`Mark in progress: ${goalText(goal)}`}
                        disabled={!logged}
                        onClick={() => move(goal, "doing")}
                      >
                        Start
                      </Button>
                    )}
                    {/* A verb and an outline, so it reads as an action rather than a status. */}
                    <Button
                      size="xs"
                      variant="outline"
                      aria-label={`Mark attained: ${goalText(goal)}`}
                      disabled={!logged}
                      onClick={() => move(goal, "done")}
                    >
                      <CheckIcon /> Mark attained
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <section aria-label="Goal progress" className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-medium">Goals</h3>
      {!future && !logged && (doing.length > 0 || todo.length > 0) && (
        <p className="text-xs text-muted-foreground">Log the day to update goals.</p>
      )}

      {doing.length === 0 && todo.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No open goals.{" "}
          <Link href={`/students/${student.id}`} className="underline underline-offset-2">
            Add one on {student.name.split(" ")[0]}&apos;s page
          </Link>
          .
        </p>
      ) : (
        <>
          {group("In progress", doing)}
          {group("Not started", todo)}
        </>
      )}
    </section>
  );
}
