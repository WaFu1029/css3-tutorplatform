"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import type { Goal, Student } from "@/lib/types";
import { GOAL_SECTIONS, goalText, isStarred } from "@/lib/goals";
import { formatDate } from "@/lib/fy";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A narrow column of the goals each student is working toward. Ticking one
 * stamps today as the date attained; attained goals fold away underneath.
 * With several students, each gets their own block under a name header.
 */
export function GoalsColumn({ students, className }: { students: Student[]; className?: string }) {
  const { db } = useStore();

  return (
    <section aria-label="Goals" className={cn("space-y-5", className)}>
      <h2 className="text-sm font-medium text-muted-foreground">Goals</h2>
      {students.length === 0 && (
        <p className="text-sm text-muted-foreground">Pick a student to see their goals.</p>
      )}
      {students.map((student) => (
        <StudentGoals
          key={student.id}
          student={student}
          goals={db.goals.filter((g) => g.studentId === student.id)}
          showName={students.length > 1}
        />
      ))}
    </section>
  );
}

function StudentGoals({
  student,
  goals,
  showName,
}: {
  student: Student;
  goals: Goal[];
  showName: boolean;
}) {
  const active = goals.filter((g) => !g.attainedDate);
  const attained = goals
    .filter((g) => g.attainedDate)
    .sort((a, b) => b.attainedDate!.localeCompare(a.attainedDate!));

  return (
    <div className="space-y-2.5">
      {showName && (
        <h3 className="border-b pb-1 font-serif text-lg leading-tight tracking-tight">
          {student.name}
        </h3>
      )}

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No goals in progress.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </ul>
      )}

      <AddGoalDialog student={student} goals={goals} />

      {attained.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" />
            Attained ({attained.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {attained.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const { setGoalAttained } = useStore();
  const id = `goal-${goal.id}`;
  const label = goalText(goal);

  return (
    <li className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={Boolean(goal.attainedDate)}
        onCheckedChange={(checked) => {
          setGoalAttained(goal.id, checked);
          if (checked) toast.success(`Attained: ${label}`);
        }}
        className="mt-0.5"
      />
      <Label
        htmlFor={id}
        className={cn(
          "block text-sm leading-snug font-normal",
          goal.attainedDate && "text-muted-foreground",
        )}
      >
        {label}
        {isStarred(goal) && <Star />}
        {goal.attainedDate && (
          <span className="block text-xs text-muted-foreground">
            {formatDate(goal.attainedDate)}
          </span>
        )}
      </Label>
    </li>
  );
}

function Star() {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="ml-0.5 cursor-help text-primary">*</span>} />
      <TooltipContent>Starred on the paper form: reported to the state</TooltipContent>
    </Tooltip>
  );
}

function AddGoalDialog({ student, goals }: { student: Student; goals: Goal[] }) {
  const { addGoal } = useStore();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const taken = new Set(goals.flatMap((g) => (g.catalogKey ? [g.catalogKey] : [])));

  function add(goal: { catalogKey: string } | { customLabel: string }, label: string) {
    addGoal(student.id, goal);
    toast.success(`Goal added for ${student.name.split(" ")[0]}`, { description: label });
    setCustom("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-muted-foreground hover:text-foreground">
            <PlusIcon /> Add goal
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a goal for {student.name}</DialogTitle>
          <DialogDescription>
            From the paper form, or in your own words. Starred goals are reported to the state.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="-mx-1 max-h-[55vh] px-1">
          <div className="space-y-4">
            {GOAL_SECTIONS.map((section) => (
              <div key={section.key} className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{section.title}</p>
                <ul>
                  {section.goals.map((g) => {
                    const has = taken.has(g.code);
                    return (
                      <li key={g.code}>
                        <button
                          type="button"
                          disabled={has}
                          onClick={() => add({ catalogKey: g.code }, g.label)}
                          className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                        >
                          <span>
                            {g.label}
                            {g.federal && <span className="ml-0.5 text-primary">*</span>}
                          </span>
                          {has && <span className="shrink-0 text-xs">added</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <form
              className="space-y-1"
              onSubmit={(e) => {
                e.preventDefault();
                const label = custom.trim();
                if (label) add({ customLabel: label }, label);
              }}
            >
              <Label htmlFor={`custom-goal-${student.id}`} className="text-sm font-medium text-muted-foreground">
                Other
              </Label>
              <div className="flex gap-2 px-0.5 pb-0.5">
                <Input
                  id={`custom-goal-${student.id}`}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="e.g. Pass the driver's written test"
                  className="flex-1 bg-input-surface"
                />
                <Button type="submit" variant="outline" disabled={!custom.trim()}>
                  Add
                </Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
