"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import type { Student } from "@/lib/types";
import { MONTH_NAMES } from "@/lib/fy";
import { slotOn, whenWhere } from "@/lib/logic";
import { formatSlotTime } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type WhenWhereDraft = { start: string; end: string; site: string };

/** Why a draft can't be saved, or null. */
export function whenWhereError(d: WhenWhereDraft): string | null {
  if (Boolean(d.start) !== Boolean(d.end)) return "Give both a start and an end time.";
  if (d.start && d.end && d.end <= d.start) return "The end time has to be after the start.";
  return null;
}

/**
 * What to store for a draft: only what differs from the schedule, so a later
 * schedule change still shows through on untouched fields.
 */
export function whenWhereInput(
  student: Student,
  date: string,
  draft: WhenWhereDraft,
  groups: Parameters<typeof slotOn>[2],
) {
  const slot = slotOn(student, date, groups);
  return {
    startTime: draft.start && draft.start !== slot?.startTime ? draft.start : undefined,
    endTime: draft.end && draft.end !== slot?.endTime ? draft.end : undefined,
    site: draft.site.trim() && draft.site.trim() !== student.site ? draft.site : undefined,
  };
}

/** Start, end and location inputs, shared by the edit form and the log form. */
export function WhenWhereFields({
  value,
  onChange,
  sitePlaceholder,
}: {
  value: WhenWhereDraft;
  onChange: (next: WhenWhereDraft) => void;
  sitePlaceholder?: string;
}) {
  const { db } = useStore();
  const ids = useId();
  const sites = [...new Set(db.students.map((s) => s.site).filter(Boolean))].sort();
  const error = whenWhereError(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Input
          type="time"
          aria-label="Start time"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          className="h-8 bg-input-surface px-2 text-sm"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="time"
          aria-label="End time"
          value={value.end}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="h-8 bg-input-surface px-2 text-sm"
        />
      </div>
      <Input
        aria-label="Location"
        list={`${ids}-sites`}
        value={value.site}
        placeholder={sitePlaceholder ?? "Location"}
        onChange={(e) => onChange({ ...value, site: e.target.value })}
        className="h-8 bg-input-surface px-2 text-sm"
      />
      <datalist id={`${ids}-sites`}>
        {sites.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * "6:00–7:30 pm · Bloomfield Public Library" for one session, with a pencil
 * to change it: past or upcoming, logged or not. Changes belong to this
 * session only; the student's regular schedule and site stay as they are.
 */
export function SessionWhenWhere({
  student,
  date,
  locked,
  className,
}: {
  student: Student;
  date: string;
  /** The month is sent: shown, and the pencil explains how to change it. */
  locked: boolean;
  className?: string;
}) {
  const { db, setSessionDetails } = useStore();
  const [editing, setEditing] = useState(false);
  const [lockedNote, setLockedNote] = useState(false);
  const now = whenWhere(student, date, db);
  const time =
    now.startTime && now.endTime
      ? formatSlotTime({ weekday: 0, startTime: now.startTime, endTime: now.endTime })
      : "";
  const [draft, setDraft] = useState<WhenWhereDraft>({ start: "", end: "", site: "" });

  function open() {
    if (locked) {
      setLockedNote(true);
      return;
    }
    setDraft({ start: now.startTime ?? "", end: now.endTime ?? "", site: now.site });
    setEditing(true);
  }

  if (editing) {
    const error = whenWhereError(draft);
    return (
      <form
        className="mt-2 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (error) return;
          setSessionDetails(student.id, date, whenWhereInput(student, date, draft, db.groups));
          setEditing(false);
          toast.success("Time and location updated", { description: student.name });
        }}
      >
        <WhenWhereFields value={draft} onChange={setDraft} sitePlaceholder={student.site} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="submit" size="xs" disabled={Boolean(error)}>
            Save
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {now.changed && (
            <Button
              type="button"
              size="xs"
              variant="link"
              className="ml-auto h-auto px-0 text-muted-foreground"
              onClick={() => {
                setSessionDetails(student.id, date, {});
                setEditing(false);
                toast.success("Back to the regular schedule", { description: student.name });
              }}
            >
              Reset to schedule
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className={className}>
      <p className="group flex items-center gap-1 text-xs text-muted-foreground">
        <span>
          {time ? `${time} · ` : "No time set · "}
          {now.site}
          {now.changed && <span className="italic"> · changed for this session</span>}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Edit this session's time and location"
          title="Edit time and location"
          onClick={open}
          className="text-muted-foreground opacity-60 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
        >
          <PencilIcon />
        </Button>
      </p>
      {lockedNote && (
        <p role="status" className="text-xs text-muted-foreground">
          {MONTH_NAMES[Number(date.slice(5, 7)) - 1]} is confirmed. Reopen it to change this
          session.
        </p>
      )}
    </div>
  );
}
