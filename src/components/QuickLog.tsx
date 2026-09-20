"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AbsenceCode, Student } from "@/lib/types";
import { formatDate, formatHours, todayISO } from "@/lib/fy";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

const PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];

const ABSENCES: { code: AbsenceCode; label: string }[] = [
  { code: "SA", label: "Student absent" },
  { code: "TA", label: "I could not make it" },
  { code: "H", label: "Holiday" },
];

const ABSENCE_WORD: Record<AbsenceCode, string> = {
  SA: "Student absent",
  TA: "Tutor absent",
  H: "Holiday",
};

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

  const chosen = preset ? Number.parseFloat(preset) : custom ? Number.parseFloat(custom) : null;
  const student = students.find((s) => s.id === activeStudentId);
  const canSave = Boolean(student && chosen && chosen > 0 && date <= today);

  function save(code: AbsenceCode | null) {
    if (!student) return;
    if (code) {
      setEntry(student.id, date, 0, code);
      toast.success(`${ABSENCE_WORD[code]} recorded`, {
        description: `${student.name} · ${formatDate(date)}`,
      });
    } else {
      if (!chosen || chosen <= 0) return;
      setEntry(student.id, date, chosen, null);
      toast.success(`${formatHours(chosen)} hours saved`, {
        description: `${student.name} · ${formatDate(date)}`,
      });
    }
    setPreset(null);
    setCustom("");
  }

  return (
    <Card className="gap-0 border-2 border-ink py-0">
      <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-4 px-4 py-4">
        <Field className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="ql-student">Student</FieldLabel>
          <NativeSelect
            id="ql-student"
            className="w-full"
            value={activeStudentId}
            onChange={(e) => onPickStudent(e.target.value)}
          >
            {students.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field className="w-auto">
          <FieldLabel htmlFor="ql-date">Date</FieldLabel>
          <Input
            id="ql-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-[10.5rem]"
          />
        </Field>

        <Field className="w-auto">
          <FieldLabel htmlFor="ql-custom">Hours</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.5">
            <ToggleGroup
              variant="outline"
              value={preset ? [preset] : []}
              onValueChange={(value: string[]) => {
                setPreset(value[0] ?? null);
                setCustom("");
              }}
            >
              {PRESETS.map((h) => (
                <ToggleGroupItem
                  key={h}
                  value={String(h)}
                  aria-label={`${formatHours(h)} hours`}
                  className="w-11 tabular-nums data-[pressed]:bg-lime data-[pressed]:font-semibold"
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
              }}
              className="w-[4.5rem]"
            />
          </div>
        </Field>

        <Button size="lg" disabled={!canSave} onClick={() => save(null)}>
          Save session
        </Button>
      </CardContent>

      <CardFooter className="flex-wrap gap-x-3 gap-y-2 border-t bg-muted px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">No session that day?</span>
        {ABSENCES.map((a) => (
          <Button key={a.code} variant="outline" size="sm" onClick={() => save(a.code)}>
            {a.label}
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}
