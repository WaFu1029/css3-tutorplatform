"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GOAL_SECTIONS } from "@/lib/goals";
import { formatDate } from "@/lib/fy";
import type { Student } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function GoalsPanel({ student }: { student: Student }) {
  const { toggleGoal, addOtherGoal, toggleOtherGoal } = useStore();
  const [newGoal, setNewGoal] = useState("");

  const attained =
    Object.keys(student.goals).length + student.otherGoals.filter((g) => g.attainedOn).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Achievements</CardTitle>
        <CardAction>
          <Badge variant={attained ? "secondary" : "outline"}>{attained} attained</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {GOAL_SECTIONS.map((section) => (
          <fieldset key={section.key} className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-muted-foreground">
              {section.title}
            </legend>
            <ul className="space-y-2">
              {section.goals.map((goal) => {
                const mark = student.goals[goal.code];
                const id = `goal-${student.id}-${goal.code}`;
                return (
                  <li key={goal.code} className="flex items-start gap-2.5">
                    <Checkbox
                      id={id}
                      checked={Boolean(mark)}
                      onCheckedChange={() => {
                        toggleGoal(student.id, goal.code);
                        if (!mark) toast.success(`Marked: ${goal.label}`);
                      }}
                      className="mt-0.5"
                    />
                    <Label htmlFor={id} className="flex-wrap text-sm leading-snug font-normal">
                      {goal.label}
                      {goal.federal && (
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="cursor-help text-primary">*</span>}
                          />
                          <TooltipContent>Reported to the state</TooltipContent>
                        </Tooltip>
                      )}
                      {mark && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(mark.attainedOn)}
                        </span>
                      )}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Other goals</legend>
          {student.otherGoals.length > 0 && (
            <ul className="space-y-2">
              {student.otherGoals.map((goal) => {
                const id = `goal-${student.id}-${goal.id}`;
                return (
                  <li key={goal.id} className="flex items-start gap-2.5">
                    <Checkbox
                      id={id}
                      checked={Boolean(goal.attainedOn)}
                      onCheckedChange={() => toggleOtherGoal(student.id, goal.id)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={id} className="flex-wrap text-sm leading-snug font-normal">
                      {goal.label}
                      {goal.attainedOn && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(goal.attainedOn)}
                        </span>
                      )}
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const label = newGoal.trim();
              if (!label) return;
              addOtherGoal(student.id, label);
              setNewGoal("");
            }}
            className="flex gap-2 pt-1"
          >
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Add a goal for this student"
              className="flex-1 bg-input-surface"
            />
            <Button type="submit" variant="outline">
              Add
            </Button>
          </form>
        </fieldset>
      </CardContent>
    </Card>
  );
}
