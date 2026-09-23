"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import type { Goal, Student } from "@/lib/types";
import { GOAL_SECTIONS, GOAL_STAGES, goalStage, goalText, isStarred, type GoalStage } from "@/lib/goals";
import { formatDate } from "@/lib/fy";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { GoalGroupTag } from "@/components/GoalGroupTag";
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
 * Each student's goals as a small board: not started, in progress, attained.
 * Cards move by dragging between lanes or with the arrows on each card.
 * Starting stamps a start date; attaining stamps the date attained.
 * With several students, each gets their own board under a name header.
 */
export function GoalsColumn({ students, className }: { students: Student[]; className?: string }) {
  const { db } = useStore();

  return (
    <section aria-label="Goals" className={cn("space-y-4", className)}>
      {students.length === 0 && (
        <p className="text-sm text-muted-foreground">Pick a student to see their goals.</p>
      )}
      {students.map((student) => (
        <StudentGoals
          key={student.id}
          student={student}
          goals={db.goals.filter((g) => g.studentId === student.id)}
          title={students.length > 1 ? student.name : "Goals"}
        />
      ))}
    </section>
  );
}

const LANE_STYLE: Record<GoalStage, { lane: string; card: string; dot: string }> = {
  todo: { lane: "bg-muted/60", card: "border-border bg-input-surface", dot: "bg-muted-foreground/50" },
  doing: { lane: "bg-sky-100/70", card: "border-sky-200 bg-white", dot: "bg-sky-500" },
  done: { lane: "bg-secondary/70", card: "border-lime/60 bg-white", dot: "bg-primary" },
};

function StudentGoals({ student, goals, title }: { student: Student; goals: Goal[]; title: string }) {
  const { setGoalStage } = useStore();
  const [over, setOver] = useState<GoalStage | null>(null);
  const [open, setOpen] = useCollapsed("lvaep.goals.open");
  const boardId = `goals-board-${student.id}`;
  const summary = GOAL_STAGES.map(({ stage, title: t }) => {
    const n = goals.filter((g) => goalStage(g) === stage).length;
    return n ? `${n} ${t.toLowerCase()}` : null;
  })
    .filter(Boolean)
    .join(" · ");

  function move(goal: Goal, stage: GoalStage) {
    if (goalStage(goal) === stage) return;
    setGoalStage(goal.id, stage);
    if (stage === "done") toast.success(`Attained: ${goalText(goal)}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={boardId}
            onClick={() => setOpen(!open)}
            className="-ml-1 flex items-center gap-1 rounded-md px-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", !open && "-rotate-90")} />
            {title}
            {!open && summary && <span className="ml-1 truncate font-normal">· {summary}</span>}
          </button>
        </h2>
        <AddGoalDialog student={student} goals={goals} />
      </div>

      <div id={boardId} hidden={!open} className="grid gap-3 md:grid-cols-3">
        {GOAL_STAGES.map(({ stage, title: laneTitle }, i) => {
          const cards = goals
            .filter((g) => goalStage(g) === stage)
            .sort((a, b) => (stageDate(b) ?? "").localeCompare(stageDate(a) ?? ""));
          return (
            <div
              key={stage}
              aria-label={laneTitle}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const goal = goals.find((g) => g.id === e.dataTransfer.getData("text/goal-id"));
                if (goal) move(goal, stage);
              }}
              className={cn(
                "min-h-[92px] rounded-lg p-2.5 transition-shadow",
                LANE_STYLE[stage].lane,
                over === stage && "ring-2 ring-primary",
              )}
            >
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <span aria-hidden className={cn("size-2 rounded-full", LANE_STYLE[stage].dot)} />
                {laneTitle}
                <span className="font-normal text-muted-foreground tabular-nums">{cards.length}</span>
              </p>
              {cards.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {stage === "todo" ? "Nothing waiting." : "Drag a goal here."}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {cards.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      className={LANE_STYLE[stage].card}
                      onBack={i > 0 ? () => move(goal, GOAL_STAGES[i - 1].stage) : undefined}
                      onForward={
                        i < GOAL_STAGES.length - 1 ? () => move(goal, GOAL_STAGES[i + 1].stage) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Open/closed for the goal board, remembered in this browser across students
 * and visits. Storage can be missing or blocked; the board then starts open.
 */
function useCollapsed(key: string): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(true);
  useEffect(() => {
    try {
      // Read after mount so the server render and first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(key) === "closed") setOpenState(false);
    } catch {}
  }, [key]);
  function setOpen(next: boolean) {
    setOpenState(next);
    try {
      window.localStorage.setItem(key, next ? "open" : "closed");
    } catch {}
  }
  return [open, setOpen];
}

/** The date that matters in the goal's lane: attained, started, or added. */
function stageDate(goal: Goal): string | undefined {
  return goal.attainedDate ?? goal.startedDate ?? goal.addedDate;
}

function GoalCard({
  goal,
  className,
  onBack,
  onForward,
}: {
  goal: Goal;
  className: string;
  onBack?: () => void;
  onForward?: () => void;
}) {
  const { removeGoal, restoreGoal } = useStore();
  const label = goalText(goal);
  const stage = goalStage(goal);

  function remove() {
    removeGoal(goal.id);
    toast(`Removed: ${label}`, {
      description: stage === "done" ? "It no longer counts as attained on reports." : undefined,
      action: { label: "Undo", onClick: () => restoreGoal(goal) },
    });
  }
  const date =
    stage === "done"
      ? `Attained ${formatDate(goal.attainedDate!)}`
      : stage === "doing"
        ? `Started ${formatDate(goal.startedDate!)}`
        : `Added ${formatDate(goal.addedDate)}`;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/goal-id", goal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group flex max-w-full min-w-[9rem] flex-[1_1_12rem] cursor-grab items-start gap-1 rounded-md border px-2 py-1.5 shadow-xs active:cursor-grabbing",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {label}
          {isStarred(goal) && <Star />}
        </p>
        <p className="text-xs text-muted-foreground">{date}</p>
        <GoalGroupTag goal={goal} className="mt-1" />
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onBack && (
          <Button variant="ghost" size="icon-xs" aria-label={`Move "${label}" back`} onClick={onBack}>
            <ChevronLeftIcon />
          </Button>
        )}
        {onForward && (
          <Button variant="ghost" size="icon-xs" aria-label={`Move "${label}" forward`} onClick={onForward}>
            <ChevronRightIcon />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove "${label}"`}
          className="text-muted-foreground hover:text-destructive"
          onClick={remove}
        >
          <XIcon />
        </Button>
      </div>
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
          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground">
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
