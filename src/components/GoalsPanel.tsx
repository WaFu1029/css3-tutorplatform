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
import { FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function GoalsPanel({ student }: { student: Student }) {
  const { toggleGoal, addOtherGoal, toggleOtherGoal } = useStore();
  const [newGoal, setNewGoal] = useState("");

  const attained =
    Object.keys(student.goals).length + student.otherGoals.filter((g) => g.attainedOn).length;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="font-display text-xl font-normal">Achievements</CardTitle>
        <CardAction>
          <Badge variant={attained ? "default" : "outline"}>{attained} attained</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 py-0">
        {GOAL_SECTIONS.map((section) => (
          <FieldSet key={section.key} className="gap-1.5 border-b px-4 py-3 last:border-b-0">
            <FieldLegend variant="label">{section.title}</FieldLegend>
            <ul className="space-y-1.5">
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
                      className="mt-0.5 data-[checked]:border-lime-deep data-[checked]:bg-lime-deep"
                    />
                    <Label htmlFor={id} className="flex-wrap text-[13px] leading-snug font-normal">
                      {goal.label}
                      {goal.federal && (
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="cursor-help text-lime-deep">*</span>}
                          />
                          <TooltipContent>Reported to the state</TooltipContent>
                        </Tooltip>
                      )}
                      {mark && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(mark.attainedOn)}
                        </span>
                      )}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </FieldSet>
        ))}

        <Separator />

        <FieldSet className="gap-1.5 px-4 py-3">
          <FieldLegend variant="label">Other goals</FieldLegend>
          {student.otherGoals.length > 0 && (
            <ul className="space-y-1.5">
              {student.otherGoals.map((goal) => {
                const id = `goal-${student.id}-${goal.id}`;
                return (
                  <li key={goal.id} className="flex items-start gap-2.5">
                    <Checkbox
                      id={id}
                      checked={Boolean(goal.attainedOn)}
                      onCheckedChange={() => toggleOtherGoal(student.id, goal.id)}
                      className="mt-0.5 data-[checked]:border-lime-deep data-[checked]:bg-lime-deep"
                    />
                    <Label htmlFor={id} className="flex-wrap text-[13px] leading-snug font-normal">
                      {goal.label}
                      {goal.attainedOn && (
                        <span className="text-[11px] text-muted-foreground">
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
            className="mt-1 flex gap-2"
          >
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Add a goal for this student"
              className="flex-1"
            />
            <Button type="submit" variant="outline">
              Add
            </Button>
          </form>
        </FieldSet>
      </CardContent>
    </Card>
  );
}
