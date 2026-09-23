"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, PrinterIcon, UsersIcon, XIcon } from "lucide-react";
import type { ScheduleSlot, Student } from "@/lib/types";
import { useStore } from "@/lib/store";
import { formatDate, todayISO } from "@/lib/fy";
import { currentSlots, formatSchedule, WEEKDAY_SHORT } from "@/lib/schedule";
import { groupsOf } from "@/lib/logic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SitePicker } from "@/components/SitePicker";
import { siteNamed, withinSiteHours } from "@/lib/sites";

export function StudentHeader({
  student,
  editable,
  stepper,
}: {
  student: Student;
  editable: boolean;
  /** The link to all students and the previous / next arrows, right-aligned on the site and schedule row. */
  stepper?: React.ReactNode;
}) {
  const { db, updateStudent, setStudentSchedule, resumeStudent } = useStore();
  const [stopping, setStopping] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const stopped = student.status === "stopped";
  const groups = groupsOf(student, db.groups);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={
                stopped
                  ? "font-serif text-4xl leading-tight tracking-tight text-muted-foreground"
                  : "font-serif text-4xl leading-tight tracking-tight"
              }
            >
              {student.name}
            </h1>
            {stopped ? (
              <Badge variant="destructive">Stopped</Badge>
            ) : (
              <Badge variant="secondary">Active</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/students/${student.id}/sheet`} />}
          >
            <PrinterIcon /> Year sheet
          </Button>
          {editable && !stopped && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setStopping(true)}
            >
              Stopped being tutored…
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Meta label="Site">
            {editable ? (
              <SitePicker
                value={student.site}
                size="sm"
                onChange={(site) => {
                  if (site === student.site) return;
                  updateStudent(student.id, { site });
                  toast.success("Site updated", { description: site });
                }}
              />
            ) : (
              <span className="font-medium">{student.site}</span>
            )}
          </Meta>
          <Meta label="Schedule">
            {editable ? (
              <button
                type="button"
                onClick={() => setEditingSchedule((v) => !v)}
                aria-expanded={editingSchedule}
                aria-label={`Edit schedule: ${formatSchedule(currentSlots(student.schedule))}`}
                className="group -mx-1 inline-flex items-center gap-1 rounded-md px-1 font-medium transition-colors hover:bg-muted"
              >
                {formatSchedule(currentSlots(student.schedule))}
                <PencilIcon className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
              </button>
            ) : (
              <span className="font-medium">{formatSchedule(currentSlots(student.schedule))}</span>
            )}
          </Meta>
          {groups.length > 0 && (
            <Meta label={groups.length === 1 ? "Group" : "Groups"}>
              <span className="inline-flex flex-wrap items-center gap-x-2 font-medium">
                {groups.map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-1">
                    <UsersIcon className="size-3.5 text-muted-foreground" />
                    {g.name}
                    {g.schedule?.length ? (
                      <span className="font-normal text-muted-foreground">
                        ({formatSchedule(currentSlots(g.schedule))})
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            </Meta>
          )}
        </dl>
        {stepper}
      </div>

      {editingSchedule && (
        <ScheduleEditor
          schedule={currentSlots(student.schedule)}
          site={student.site}
          onCancel={() => setEditingSchedule(false)}
          onSave={(slots) => {
            // A new version from today, so past days keep the schedule they had.
            setStudentSchedule(student.id, slots);
            setEditingSchedule(false);
            toast.success("Schedule updated", { description: formatSchedule(slots) });
          }}
        />
      )}

      {stopped && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm">
          <p className="flex items-baseline gap-2">
            <span aria-hidden className="size-2 shrink-0 -translate-y-px rounded-full bg-destructive" />
            <span>
              <span className="font-medium">
                No longer tutored
                {student.stoppedDate ? ` as of ${formatDate(student.stoppedDate)}` : ""}.
              </span>{" "}
              <span className="text-muted-foreground">{student.stoppedReason}</span>
            </span>
          </p>
          {editable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resumeStudent(student.id);
                toast.success(`${student.name} is active again`);
              }}
            >
              Reactivate
            </Button>
          )}
        </div>
      )}

      <StopDialog student={student} open={stopping} onOpenChange={setStopping} />
    </header>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** One row per tutoring day, each with its own times. */
function ScheduleEditor({
  schedule,
  site,
  onSave,
  onCancel,
}: {
  schedule: ScheduleSlot[];
  /** Days outside this site's open hours are flagged, not blocked. */
  site: string;
  onSave: (next: ScheduleSlot[]) => void;
  onCancel: () => void;
}) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(() =>
    [...schedule].sort((a, b) => a.weekday - b.weekday),
  );
  const used = new Set(slots.map((s) => s.weekday));
  const invalid = slots.some((s) => !s.startTime || !s.endTime || s.endTime <= s.startTime);

  function patch(weekday: number, next: Partial<ScheduleSlot>) {
    setSlots((prev) => prev.map((s) => (s.weekday === weekday ? { ...s, ...next } : s)));
  }

  function add(weekday: number) {
    // A new day starts from the times already in use, the usual case.
    const like = slots[0] ?? { startTime: "18:00", endTime: "19:00" };
    setSlots((prev) =>
      [...prev, { weekday, startTime: like.startTime, endTime: like.endTime }].sort(
        (a, b) => a.weekday - b.weekday,
      ),
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl bg-card p-4"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onSave(slots);
      }}
    >
      <p className="text-sm font-medium">Tutoring days and times</p>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No regular days: a walk-in. Nothing is expected on any date, and any day can be logged.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {slots.map((slot) => {
            const bad = slot.endTime <= slot.startTime;
            return (
              <li key={slot.weekday} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-10 font-medium">{WEEKDAY_SHORT[slot.weekday]}</span>
                <Input
                  type="time"
                  aria-label={`${WEEKDAY_SHORT[slot.weekday]} start`}
                  value={slot.startTime}
                  onChange={(e) => patch(slot.weekday, { startTime: e.target.value })}
                  className="h-8 w-32 bg-input-surface"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  aria-label={`${WEEKDAY_SHORT[slot.weekday]} end`}
                  aria-invalid={bad ? true : undefined}
                  value={slot.endTime}
                  onChange={(e) => patch(slot.weekday, { endTime: e.target.value })}
                  className="h-8 w-32 bg-input-surface"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${WEEKDAY_SHORT[slot.weekday]}`}
                  onClick={() => setSlots((prev) => prev.filter((s) => s.weekday !== slot.weekday))}
                >
                  <XIcon />
                </Button>
                {bad ? (
                  <span className="text-xs text-destructive">Ends before it starts.</span>
                ) : (
                  !withinSiteHours(site, slot) && (
                    <span className="text-xs text-muted-foreground">
                      Outside {site.split(" ")[0]}&apos;s hours ({siteNamed(site)?.hoursLabel})
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">Add a day</span>
        {WEEKDAY_SHORT.map((name, weekday) =>
          used.has(weekday) ? null : (
            <Button
              key={name}
              type="button"
              size="xs"
              variant="ghost"
              className="bg-muted hover:bg-muted-hover"
              onClick={() => add(weekday)}
            >
              <PlusIcon /> {name}
            </Button>
          ),
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={invalid}>
          Save schedule
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The paper form asks why a student stopped, so the reason is required here too. */
function StopDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { stopStudent } = useStore();
  const today = todayISO();
  const [reason, setReason] = useState("");
  const [on, setOn] = useState(today);
  const ready =
    reason.trim().length > 0 && on <= today && (!student.startedOn || on >= student.startedOn);

  function close() {
    onOpenChange(false);
    setReason("");
    setOn(today);
  }

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            stopStudent(student.id, reason.trim(), on);
            close();
            toast.info(`${student.name} marked as stopped`, {
              description: "The office sees this on the monthly report.",
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{student.name} stopped being tutored</DialogTitle>
            <DialogDescription>
              Scheduled days after this date stop counting as unlogged. You can reactivate the
              student if tutoring starts again.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor={`stop-reason-${student.id}`}>Reason</FieldLabel>
            <Input
              id={`stop-reason-${student.id}`}
              required
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Moved, schedule conflict, goals met…"
              className="bg-input-surface"
            />
            <FieldDescription>Printed on the year sheet, as the paper form asks.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor={`stop-on-${student.id}`}>Last day tutored</FieldLabel>
            <Input
              id={`stop-on-${student.id}`}
              type="date"
              value={on}
              min={student.startedOn}
              max={today}
              onChange={(e) => setOn(e.target.value)}
              className="w-[10.5rem] bg-input-surface"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Keep tutoring
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready}>
              Mark stopped
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
