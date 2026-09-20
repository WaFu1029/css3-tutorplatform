"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import type { AbsenceCode, Student } from "@/lib/types";
import { ABSENCE_CODES, ABSENCE_LABEL } from "@/lib/absence";
import { formatDate, formatHours, MAX_SESSION_HOURS, todayISO } from "@/lib/fy";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];

export function QuickLog({
  students,
  activeStudentId,
  onPickStudent,
}: {
  students: Student[];
  activeStudentId: string;
  onPickStudent: (id: string) => void;
}) {
  const { setEntry } = useStore();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [preset, setPreset] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [absence, setAbsence] = useState<AbsenceCode | null>(null);

  const studentLabels = Object.fromEntries(students.map((s) => [s.id, s.name]));

  const chosen = preset ? Number.parseFloat(preset) : custom ? Number.parseFloat(custom) : null;
  const student = students.find((s) => s.id === activeStudentId);

  const typed = custom.trim();
  const hoursError = !typed
    ? null
    : chosen === null || Number.isNaN(chosen) || chosen <= 0
      ? `"${typed}" is not a number of hours.`
      : chosen > MAX_SESSION_HOURS
        ? `A session tops out at ${MAX_SESSION_HOURS} hours.`
        : null;

  // Hours and an absence are mutually exclusive: one or the other arms the save.
  const armed = absence !== null || Boolean(chosen && chosen > 0);
  const canSave = Boolean(student && armed && !hoursError && date <= today);

  function pickHours(next: string | null) {
    setPreset(next);
    setCustom("");
    setAbsence(null);
  }

  function pickAbsence(code: AbsenceCode | null) {
    setAbsence(code);
    if (code) {
      setPreset(null);
      setCustom("");
    }
  }

  function save() {
    if (!student) return;
    if (absence) {
      setEntry(student.id, date, 0, absence);
      toast.success(`${ABSENCE_LABEL[absence]} recorded`, {
        description: `${student.name} · ${formatDate(date)}`,
      });
    } else {
      if (!chosen || chosen <= 0 || chosen > MAX_SESSION_HOURS) return;
      setEntry(student.id, date, chosen, null);
      toast.success(`${formatHours(chosen)} hours saved`, {
        description: `${student.name} · ${formatDate(date)}`,
      });
    }
    setPreset(null);
    setCustom("");
    setAbsence(null);
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Field className="min-w-[200px] flex-1">
            <FieldLabel htmlFor="ql-student">Student</FieldLabel>
            <Select
              items={studentLabels}
              value={activeStudentId}
              onValueChange={(value: string | null) => value && onPickStudent(value)}
            >
              <SelectTrigger id="ql-student" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="w-auto">
            <FieldLabel htmlFor="ql-date">Date</FieldLabel>
            <Input
              id="ql-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[10.5rem] bg-input-surface"
            />
          </Field>

          <Field className="w-auto">
            <FieldLabel htmlFor="ql-custom">Hours</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              <ToggleGroup
                value={preset ? [preset] : []}
                onValueChange={(value: string[]) => pickHours(value[0] ?? null)}
              >
                {PRESETS.map((h) => (
                  <ToggleGroupItem
                    key={h}
                    value={String(h)}
                    aria-label={`${formatHours(h)} hours`}
                    className="h-9 w-11 tabular-nums border-transparent bg-muted hover:bg-muted-hover data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground data-[pressed]:hover:bg-secondary"
                  >
                    {formatHours(h)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Input
                id="ql-custom"
                inputMode="decimal"
                value={custom}
                placeholder="other"
                onChange={(e) => {
                  setCustom(e.target.value);
                  setPreset(null);
                  setAbsence(null);
                }}
                aria-invalid={hoursError ? true : undefined}
                className="h-9 w-[4.5rem] bg-input-surface"
              />
            </div>
            {hoursError ? <FieldError>{hoursError}</FieldError> : null}
          </Field>

          <Button
            disabled={!canSave}
            onClick={save}
            className={cn(
              "h-9",
              absence && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Save session
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">No session that day?</span>
          <ToggleGroup
            value={absence ? [absence] : []}
            onValueChange={(value: string[]) =>
              pickAbsence((value[0] as AbsenceCode | undefined) ?? null)
            }
          >
            {ABSENCE_CODES.map((code) => (
              <ToggleGroupItem
                key={code}
                value={code}
                size="sm"
                className="border-transparent bg-muted hover:bg-muted-hover data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground data-[pressed]:hover:bg-secondary"
              >
                {ABSENCE_LABEL[code]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  );
}
