"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import type { AbsenceCode, SessionEntry, Student } from "@/lib/types";
import { ABSENCE_CODES, ABSENCE_LABEL } from "@/lib/absence";
import { formatDate, formatHours, MAX_SESSION_HOURS, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { entryOn, isMonthSent, scheduledHours, slotOn } from "@/lib/logic";
import { formatSlotTime } from "@/lib/schedule";
import { useStore, type EntryValue } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];

const CHIP =
  "border-transparent bg-muted hover:bg-muted-hover data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground data-[pressed]:hover:bg-secondary";

/** What the tutor has picked. Custom text is kept raw so a half-typed number survives. */
type Choice =
  | { kind: "preset"; hours: number }
  | { kind: "custom"; text: string }
  | { kind: "code"; code: AbsenceCode };

function choiceFor(value: EntryValue): Choice {
  if ("code" in value) return { kind: "code", code: value.code };
  return PRESETS.includes(value.hours)
    ? { kind: "preset", hours: value.hours }
    : { kind: "custom", text: String(value.hours) };
}

function entryValue(entry: SessionEntry): EntryValue {
  return entry.code ? { code: entry.code } : { hours: entry.hours ?? 0 };
}

function sameValue(a: EntryValue, b: EntryValue): boolean {
  return "code" in a ? "code" in b && a.code === b.code : "hours" in b && a.hours === b.hours;
}

function names(students: Student[]): string {
  const list = students.map((s) => s.name.split(" ")[0]);
  return list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

/**
 * The one place sessions get logged. Pick one or more students, a date, and
 * either hours or the reason there was no session. Several students saved
 * together become a group session.
 *
 * Selection is controlled when `selectedIds` is passed (the home page does,
 * so the goals column can follow it); otherwise `preselectedStudentId` seeds it.
 */
export function LoggingBar({
  students,
  preselectedStudentId,
  selectedIds,
  onSelectedIdsChange,
  className,
}: {
  students: Student[];
  preselectedStudentId?: string;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  className?: string;
}) {
  const { db, saveEntries, reopenMonth } = useStore();
  const today = todayISO();

  const [ownSelection, setOwnSelection] = useState<string[]>(() =>
    preselectedStudentId ? [preselectedStudentId] : students[0] ? [students[0].id] : [],
  );
  const [date, setDate] = useState(today);
  const [choice, setChoice] = useState<Choice | null>(null);

  const selection = (selectedIds ?? ownSelection).filter((id) => students.some((s) => s.id === id));
  const selected = students.filter((s) => selection.includes(s.id));
  const month = monthKey(date);

  function select(ids: string[]) {
    if (!selectedIds) setOwnSelection(ids);
    onSelectedIdsChange?.(ids);
    setChoice(null);
  }

  /* ---- what's already there, and what the schedule suggests ---- */

  const existing = selected.flatMap((s) => {
    const e = entryOn(db.entries, s.id, date);
    return e ? [{ student: s, entry: e }] : [];
  });
  const locked = selected.filter((s) => isMonthSent(db.reports, s.id, month));

  const scheduled = selected.flatMap((s) => {
    const hours = scheduledHours(s, date);
    return hours === null ? [] : [{ student: s, hours }];
  });

  // The value the bar opens on: what's logged when every selected student has
  // the same entry, else the scheduled length when they share one.
  let suggestion: { value: EntryValue; source: "logged" | "schedule" } | null = null;
  if (existing.length > 0 && existing.length === selected.length) {
    const first = entryValue(existing[0].entry);
    if (existing.every((x) => sameValue(entryValue(x.entry), first))) {
      suggestion = { value: first, source: "logged" };
    }
  } else if (scheduled.length > 0 && scheduled.every((x) => x.hours === scheduled[0].hours)) {
    suggestion = { value: { hours: scheduled[0].hours }, source: "schedule" };
  }

  const effective: Choice | null = choice ?? (suggestion ? choiceFor(suggestion.value) : null);

  /* ---- validation ---- */

  const customText = effective?.kind === "custom" ? effective.text.trim() : "";
  const customHours = customText ? Number.parseFloat(customText) : null;
  const hoursError =
    effective?.kind !== "custom" || !customText
      ? null
      : customHours === null || Number.isNaN(customHours) || customHours <= 0
        ? `"${customText}" is not a number of hours.`
        : customHours > MAX_SESSION_HOURS
          ? `A session tops out at ${MAX_SESSION_HOURS} hours.`
          : null;

  const value: EntryValue | null =
    effective?.kind === "code"
      ? { code: effective.code }
      : effective?.kind === "preset"
        ? { hours: effective.hours }
        : effective?.kind === "custom" && customHours && !hoursError
          ? { hours: customHours }
          : null;

  const dateError = date > today ? "Sessions can't be logged ahead of time." : null;
  const canSave = selected.length > 0 && value !== null && !dateError && locked.length === 0;

  const group = selected.length > 1;
  const editing = existing.length > 0;

  function save() {
    if (!canSave || !value) return;
    const result = saveEntries(selection, date, value);
    const what = "code" in value ? ABSENCE_LABEL[value.code] : `${formatHours(value.hours)} hours`;
    toast.success(editing ? `Updated: ${what}` : `${what} saved`, {
      description: `${names(selected)} · ${formatDate(date)}${group ? " · group session" : ""}`,
    });
    if (result.locked.length) {
      toast.warning(`${monthLabel(month)} is already sent for ${result.locked.length} student(s)`);
    }
    setChoice(null);
  }

  function reopen() {
    for (const s of locked) reopenMonth(s.id, month);
    toast.info(`${monthLabel(month)} reopened`, { description: names(locked) });
  }

  const hint =
    suggestion?.source === "schedule" && choice === null
      ? `Scheduled ${formatSlotTime(slotOn(scheduled[0].student, date)!)} · hours filled in from the schedule`
      : null;

  return (
    <Card className={className}>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Field className="w-auto min-w-0 flex-1">
            <FieldLabel>
              Student{students.length > 1 ? "s" : ""}
              {group && (
                <span className="font-normal text-muted-foreground">
                  · group session of {selected.length}
                </span>
              )}
            </FieldLabel>
            <ToggleGroup
              multiple
              value={selection}
              onValueChange={(ids: string[]) => select(ids)}
              className="flex-wrap"
              aria-label="Students in this session"
            >
              {students.map((s) => (
                <ToggleGroupItem key={s.id} value={s.id} className={cn("h-9 px-3", CHIP)}>
                  {s.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field className="w-auto">
            <FieldLabel htmlFor="lb-date">Date</FieldLabel>
            <Input
              id="lb-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => {
                setDate(e.target.value);
                setChoice(null);
              }}
              aria-invalid={dateError ? true : undefined}
              className="h-9 w-[10.5rem] bg-input-surface"
            />
            {dateError ? <FieldError>{dateError}</FieldError> : null}
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Field className="w-auto">
            <FieldLabel htmlFor="lb-custom">Hours</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              <ToggleGroup
                value={effective?.kind === "preset" ? [String(effective.hours)] : []}
                onValueChange={(v: string[]) =>
                  setChoice(v[0] ? { kind: "preset", hours: Number(v[0]) } : { kind: "custom", text: "" })
                }
              >
                {PRESETS.map((h) => (
                  <ToggleGroupItem
                    key={h}
                    value={String(h)}
                    aria-label={`${formatHours(h)} hours`}
                    className={cn("h-9 w-11 tabular-nums", CHIP)}
                  >
                    {formatHours(h)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Input
                id="lb-custom"
                inputMode="decimal"
                value={effective?.kind === "custom" ? effective.text : ""}
                placeholder="other"
                onChange={(e) => setChoice({ kind: "custom", text: e.target.value })}
                aria-invalid={hoursError ? true : undefined}
                className="h-9 w-[4.5rem] bg-input-surface"
              />
            </div>
            {hoursError ? <FieldError>{hoursError}</FieldError> : null}
          </Field>

          <Field className="w-auto">
            <FieldLabel>No session that day?</FieldLabel>
            <ToggleGroup
              value={effective?.kind === "code" ? [effective.code] : []}
              onValueChange={(v: string[]) =>
                setChoice(v[0] ? { kind: "code", code: v[0] as AbsenceCode } : { kind: "custom", text: "" })
              }
            >
              {ABSENCE_CODES.map((code) => (
                <ToggleGroupItem key={code} value={code} className={cn("h-9 px-3", CHIP)}>
                  {ABSENCE_LABEL[code]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Button disabled={!canSave} onClick={save} className="ml-auto h-9">
            {editing ? "Update" : "Save"} {group ? "group session" : "session"}
          </Button>
        </div>

        {(locked.length > 0 || editing || hint) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {locked.length > 0 ? (
              <p className="flex flex-wrap items-center gap-x-2">
                <span className="text-foreground">
                  {monthLabel(month)} is already sent for {names(locked)}.
                </span>
                Reopen it to change this day.
                <Button variant="link" size="sm" className="h-auto px-0" onClick={reopen}>
                  Reopen {monthLabel(month).split(" ")[0]}
                </Button>
              </p>
            ) : editing ? (
              <p>
                Already logged for {names(existing.map((x) => x.student))} on {formatDate(date)}.
                Saving replaces {existing.length === 1 ? "that entry" : "those entries"}.
              </p>
            ) : (
              <p>{hint}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
