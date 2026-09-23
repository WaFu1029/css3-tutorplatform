"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "cn";
import type { Student } from "@/lib/types";
import { formatDate, formatHours, MAX_SESSION_HOURS, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { entryOn, heldHours, isMonthSent, ledgerOf, whenWhere } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmOverwrite } from "@/components/ConfirmOverwrite";
import { SessionGoals } from "./SessionGoals";
import { NoteField } from "./SessionNote";
import {
  WhenWhereFields,
  whenWhereError,
  whenWhereInput,
  type WhenWhereDraft,
} from "./SessionWhenWhere";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];

/**
 * Log a session that isn't on the schedule: any student, any past day or
 * today. A day holds one entry per student, so a student who already has
 * hours that day gets the new hours added on; one marked TA/SA/H is replaced,
 * after the usual confirmation.
 */
export function LogSessionForm({
  students,
  date,
  onBack,
  onCancel,
  onLogged,
}: {
  students: Student[];
  date: string;
  /**
   * Back to the card the form was opened from. Asks before throwing away a
   * half-filled form. Omitted where the form is all the day has.
   */
  onBack?: () => void;
  /** Discards the form without asking. */
  onCancel?: () => void;
  onLogged: (studentId: string) => void;
}) {
  const { db, saveEntries, setEntryNote, setSessionDetails } = useStore();
  // On one student's own page there's no one else to pick.
  const [studentId, setStudentId] = useState<string | null>(
    students.length === 1 ? students[0].id : null,
  );
  const [preset, setPreset] = useState<number | null>(null);
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  // Null until touched: the fields show the picked student's schedule that day.
  const [where, setWhere] = useState<WhenWhereDraft | null>(null);

  const student = students.find((s) => s.id === studentId) ?? null;
  const { guard, dialog } = useConfirmOverwrite(student?.name ?? "");
  const [confirmingBack, setConfirmingBack] = useState(false);
  const dirty =
    (studentId !== null && students.length > 1) ||
    preset !== null ||
    other.trim() !== "" ||
    note.trim() !== "" ||
    where !== null;

  if (date > todayISO()) return null;

  const typed = other.trim() ? Number.parseFloat(other) : null;
  const typedError =
    typed === null
      ? null
      : Number.isNaN(typed) || typed <= 0
        ? `"${other.trim()}" is not a number of hours.`
        : typed > MAX_SESSION_HOURS
          ? `A session tops out at ${MAX_SESSION_HOURS} hours.`
          : null;
  const suggested = student ? heldHours(student, date, ledgerOf(db)) : null;
  const hours = typed ?? preset ?? suggested;

  const scheduled = student ? whenWhere(student, date, db) : null;
  const whereShown: WhenWhereDraft = where ?? {
    start: scheduled?.startTime ?? "",
    end: scheduled?.endTime ?? "",
    site: scheduled?.site ?? "",
  };
  const whereError = where ? whenWhereError(where) : null;

  const existing = student ? entryOn(db.entries, student.id, date) : undefined;
  const addsTo = existing?.hours ?? null;
  const locked = student ? isMonthSent(db.reports, student.id, monthKey(date)) : false;
  const ready = Boolean(student && hours && hours > 0 && !typedError && !whereError && !locked);

  function save() {
    if (!student || !hours) return;
    const total = addsTo !== null ? addsTo + hours : hours;
    const value = { hours: total };
    const write = () => {
      saveEntries([student.id], date, value);
      if (where) setSessionDetails(student.id, date, whenWhereInput(student, date, where, db.groups));
      // Adding to a day that already has a note appends rather than replaces it.
      if (note.trim()) {
        const before = existing?.note?.trim();
        setEntryNote(student.id, date, before ? `${before} ${note.trim()}` : note.trim());
      }
      toast.success(
        addsTo !== null
          ? `${formatHours(hours)} h added · ${formatHours(total)} h that day`
          : `${formatHours(hours)} hours saved`,
        { description: `${student.name} · ${formatDate(date)}` },
      );
      onLogged(student.id);
      setPreset(null);
      setOther("");
      setNote("");
      setWhere(null);
    };
    // Adding to hours already there isn't an overwrite; replacing TA/SA/H is.
    if (addsTo !== null) write();
    else guard(date, existing, value, write);
  }

  return (
    <div className="space-y-3">
      {dialog}
      {onBack || onCancel ? (
        <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <Button
              variant="ghost"
              size="xs"
              className="-ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => (dirty ? setConfirmingBack(true) : onBack())}
            >
              <ChevronLeftIcon /> Back
            </Button>
          ) : (
            <span />
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      ) : null}
      {onBack || onCancel ? (
        <div>
          <h2 className="text-sm font-medium">Log a session</h2>
          <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
        </div>
      ) : (
        // Inline under the day's own heading, which already carries the date.
        <p className="text-sm font-medium">Log a session</p>
      )}

      <AlertDialog open={confirmingBack} onOpenChange={setConfirmingBack}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {student
                ? `The session for ${student.name} on ${formatDate(date)} hasn't been saved.`
                : "What you've picked hasn't been saved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmingBack(false);
                onBack?.();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className={cn("flex flex-wrap gap-1.5", students.length === 1 && "hidden")} role="group" aria-label="Student">
        {students.map((s) => {
          const on = s.id === studentId;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setStudentId(on ? null : s.id);
                setPreset(null);
                setWhere(null);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "bg-secondary text-secondary-foreground" : "bg-muted hover:bg-muted-hover",
              )}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {student && (
        <>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Hours">
            {PRESETS.map((h) => {
              const on = typed === null && hours === h;
              return (
                <Button
                  key={h}
                  size="xs"
                  variant={on ? "secondary" : "ghost"}
                  aria-pressed={on}
                  className={cn("w-9 tabular-nums", !on && "bg-muted hover:bg-muted-hover")}
                  onClick={() => {
                    setPreset(h);
                    setOther("");
                  }}
                >
                  {formatHours(h)}
                </Button>
              );
            })}
            <Input
              aria-label="Other hours"
              inputMode="decimal"
              placeholder="other"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ready && save()}
              aria-invalid={typedError ? true : undefined}
              className="h-6 w-16 bg-input-surface px-2 text-xs"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Time and location</p>
            <WhenWhereFields value={whereShown} onChange={setWhere} sitePlaceholder={student.site} />
          </div>

          {typedError ? (
            <p className="text-xs text-destructive">{typedError}</p>
          ) : locked ? (
            <p className="text-xs text-muted-foreground">
              {monthLabel(monthKey(date)).split(" ")[0]} is confirmed for {student.name.split(" ")[0]}.
              Reopen it to log this.
            </p>
          ) : existing?.code ? (
            <p className="text-xs text-muted-foreground">
              Replaces the {existing.code} already logged that day.
            </p>
          ) : addsTo !== null && hours ? (
            <p className="text-xs text-muted-foreground">
              Already {formatHours(addsTo)} h that day; this makes {formatHours(addsTo + hours)} h.
            </p>
          ) : null}

          <Button size="sm" className="w-full" disabled={!ready} onClick={save}>
            {addsTo !== null ? "Add" : "Save"} {hours ? `${formatHours(hours)} h` : "session"}
          </Button>

          {/* The same goal progress the day's card offers, for whoever is picked. */}
          <SessionGoals student={student} date={date} />

          <NoteField id={`log-note-${date}`} value={note} onChange={setNote} />
        </>
      )}
    </div>
  );
}
