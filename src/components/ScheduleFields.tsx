"use client";

import { useState } from "react";
import type { ScheduleSlot } from "@/lib/types";
import { MAX_SESSION_HOURS } from "@/lib/fy";
import { slotHours, WEEKDAY_SHORT } from "@/lib/schedule";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const CHIP =
  "h-8 w-11 border-transparent bg-muted hover:bg-muted-hover data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground data-[pressed]:hover:bg-secondary";

/**
 * Weekday chips and one time range. No days picked means no schedule: a
 * walk-in student, or a group that meets when it meets.
 */
export function useScheduleFields(initial: ScheduleSlot[] = []) {
  const [weekdays, setWeekdays] = useState<string[]>(() => initial.map((s) => String(s.weekday)));
  const [startTime, setStartTime] = useState(initial[0]?.startTime ?? "18:00");
  const [endTime, setEndTime] = useState(initial[0]?.endTime ?? "19:30");

  const length = slotHours({ weekday: 0, startTime, endTime });
  const error =
    weekdays.length === 0
      ? null
      : length <= 0
        ? "The session has to end after it starts."
        : length > MAX_SESSION_HOURS
          ? `A session tops out at ${MAX_SESSION_HOURS} hours.`
          : null;

  const schedule: ScheduleSlot[] = weekdays
    .map(Number)
    .sort((a, b) => a - b)
    .map((weekday) => ({ weekday, startTime, endTime }));

  function reset(next: ScheduleSlot[] = []) {
    setWeekdays(next.map((s) => String(s.weekday)));
    setStartTime(next[0]?.startTime ?? "18:00");
    setEndTime(next[0]?.endTime ?? "19:30");
  }

  return { weekdays, setWeekdays, startTime, setStartTime, endTime, setEndTime, error, schedule, reset };
}

export function ScheduleFields({
  idPrefix,
  fields,
  emptyHint,
}: {
  idPrefix: string;
  fields: ReturnType<typeof useScheduleFields>;
  /** What no days means here, e.g. "Leave empty for a walk-in student." */
  emptyHint: string;
}) {
  const { weekdays, setWeekdays, startTime, setStartTime, endTime, setEndTime, error } = fields;
  return (
    <>
      <Field>
        <FieldLabel>Days (optional)</FieldLabel>
        <ToggleGroup
          multiple
          value={weekdays}
          onValueChange={(v: string[]) => setWeekdays(v)}
          className="flex-wrap"
          aria-label="Days"
        >
          {WEEKDAY_SHORT.map((day, i) => (
            <ToggleGroupItem key={day} value={String(i)} className={CHIP}>
              {day}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {weekdays.length === 0 && <FieldDescription>{emptyHint}</FieldDescription>}
      </Field>
      {weekdays.length > 0 && (
        <Field orientation="responsive">
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-start`}>From</FieldLabel>
            <Input
              id={`${idPrefix}-start`}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-input-surface"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-end`}>To</FieldLabel>
            <Input
              id={`${idPrefix}-end`}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-invalid={error ? true : undefined}
              className="bg-input-surface"
            />
          </Field>
        </Field>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </>
  );
}
