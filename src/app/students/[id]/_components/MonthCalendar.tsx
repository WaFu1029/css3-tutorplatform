"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import type { AbsenceCode, Group, SessionEntry, Student } from "@/lib/types";
import type { EntryValue } from "@/lib/store";
import { ABSENCE_CODES, ABSENCE_KEYS, ABSENCE_LABEL } from "@/lib/absence";
import {
  addDays,
  dateKey,
  daysInMonth,
  formatDate,
  formatHours,
  MAX_SESSION_HOURS,
  MONTH_NAMES,
  monthKey,
  monthLabel,
  todayISO,
  weekdayOf,
} from "@/lib/fy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useConfirmOverwrite } from "@/components/ConfirmOverwrite";
import { enrolledOn, scheduledDates } from "@/lib/logic";
import { WEEKDAY_SHORT } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { LogSessionForm } from "@/app/_components/LogSessionForm";
import { SessionGoals } from "@/app/_components/SessionGoals";
import { SessionNote } from "@/app/_components/SessionNote";
import { SessionWhenWhere } from "@/app/_components/SessionWhenWhere";
import { GroupAppointments } from "@/components/GroupAppointments";

const PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];

type Props = {
  student: Student;
  /** The fiscal year's months; navigation stays inside them. */
  months: string[];
  month: string;
  onMonthChange: (month: string) => void;
  index: Map<string, SessionEntry>;
  /** Groups whose schedules count as the student's scheduled days. */
  groups: Group[];
  /** Unlogged scheduled days, from lib/logic unloggedDays, so the rule lives in one place. */
  unlogged: string[];
  /** Scheduled days the tutor said there's nothing to record for. */
  dismissed: Set<string>;
  /** A sent month is read-only until it is reopened. */
  sent: boolean;
  onSet: (date: string, value: EntryValue) => void;
  onClear: (date: string) => void;
  /** Dismiss an unlogged day, or undo that with `undo`. */
  onDismiss: (date: string, undo?: boolean) => void;
  /**
   * Where the selected day's editor renders: a panel beside the calendar.
   * Without one it sits in a bar under the grid.
   */
  editorTarget?: HTMLElement | null;
  /** The month's totals and send button, as a strip under the month header. */
  summary?: React.ReactNode;
};

export function MonthCalendar({
  student,
  months,
  month,
  onMonthChange,
  index,
  groups,
  unlogged,
  dismissed,
  sent,
  onSet,
  onClear,
  onDismiss,
  editorTarget,
  summary,
}: Props) {
  const today = todayISO();
  const at = months.indexOf(month);
  const days = daysInMonth(month);
  const scheduled = new Set(scheduledDates(student, month, groups));
  const missing = new Set(unlogged);
  const monthName = MONTH_NAMES[Number(month.slice(5)) - 1];

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Changing or clearing a day that is already logged asks first.
  const { guard, dialog } = useConfirmOverwrite(student.name);
  const cells = useRef(new Map<string, HTMLButtonElement>());
  // Set when the keyboard moves the selection, so focus follows it across a
  // month change once the new month has rendered.
  const pendingFocus = useRef<string | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A selection from another month (after paging or a jump from the year
  // strip) is not shown.
  const current = selected && monthKey(selected) === month ? selected : null;

  useEffect(() => {
    if (pendingFocus.current) {
      cells.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  useEffect(() => () => clearTimeout(messageTimer.current ?? undefined), []);

  // Clicking anywhere but a day or the editing bar under the grid lets go of
  // the selected day, including the calendar's own header, weekday row and
  // blank padding. The overwrite dialog and toasts are left alone.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('[data-day], [data-day-editor], [role="alertdialog"], [data-sonner-toaster]'))
        return;
      // Blur first, synchronously, so hours typed into the day are saved by
      // the cell's own blur handler before the selection goes.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && root.current?.contains(focused)) focused.blur();
      setSelected(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function flash(text: string) {
    setMessage(text);
    clearTimeout(messageTimer.current ?? undefined);
    messageTimer.current = setTimeout(() => setMessage(null), 4000);
  }

  function select(date: string, focus = false) {
    setSelected(date);
    setDraft(null);
    setMessage(null);
    if (focus) {
      if (monthKey(date) !== month) onMonthChange(monthKey(date));
      pendingFocus.current = date;
    }
  }

  function goTo(i: number) {
    if (i < 0 || i >= months.length) return;
    setDraft(null);
    onMonthChange(months[i]);
  }

  /** Why a date can't be written to, or null when it can. */
  function blocked(date: string): string | null {
    if (sent) return `${monthName} is confirmed. Reopen it to make changes.`;
    if (date > today) return `${formatDate(date)} hasn't happened yet.`;
    return null;
  }

  function write(date: string, value: EntryValue) {
    const reason = blocked(date);
    if (reason) return flash(reason);
    guard(date, index.get(`${student.id}:${date}`), value, () => onSet(date, value));
  }

  function clear(date: string) {
    const reason = blocked(date);
    if (reason) return flash(reason);
    guard(date, index.get(`${student.id}:${date}`), null, () => onClear(date));
  }

  function commitHours(date: string, raw: string) {
    setDraft(null);
    const text = raw.trim();
    if (!text) return;
    const value = Number.parseFloat(text);
    if (Number.isNaN(value)) return flash(`"${text}" is not a number of hours.`);
    if (value <= 0) return clear(date);
    if (value > MAX_SESSION_HOURS) {
      return flash(`A session tops out at ${MAX_SESSION_HOURS} hours.`);
    }
    write(date, { hours: value });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, date: string) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      if (draft !== null) commitHours(date, draft);
      const next = addDays(date, step);
      if (months.includes(monthKey(next))) select(next, true);
      return;
    }
    if (e.key === "Enter" && draft !== null) {
      e.preventDefault();
      commitHours(date, draft);
      return;
    }
    if (e.key === "Escape") {
      // First Escape drops what's being typed; the next one lets go of the day.
      if (draft === null) {
        setSelected(null);
        e.currentTarget.blur();
      }
      setDraft(null);
      setMessage(null);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      if (draft !== null) setDraft(draft.length > 1 ? draft.slice(0, -1) : null);
      else clear(date);
      return;
    }
    if (/^[0-9.]$/.test(e.key)) {
      e.preventDefault();
      const reason = blocked(date);
      if (reason) return flash(reason);
      setDraft((prev) => ((prev ?? "") + e.key).slice(0, 4));
      return;
    }
    const code = ABSENCE_KEYS[e.key.toLowerCase()];
    if (code) {
      e.preventDefault();
      setDraft(null);
      write(date, { code });
    }
  }

  /** A plain-words line for the selected day, shown atop the panel. */
  function dayState(date: string): string {
    const e = index.get(`${student.id}:${date}`);
    if (e?.code) return ABSENCE_LABEL[e.code];
    if (e) return `${formatHours(e.hours ?? 0)} hour${e.hours === 1 ? "" : "s"} held`;
    if (missing.has(date)) return "Scheduled, not logged yet";
    if (dismissed.has(date)) return "Scheduled, nothing to record";
    if (scheduled.has(date)) return date > today ? "Scheduled, coming up" : "Scheduled";
    return "Not a scheduled day — you can still log a session";
  }

  const leading = weekdayOf(dateKey(month, 1));
  const trailing = (7 - ((leading + days) % 7)) % 7;
  const entry = current ? index.get(`${student.id}:${current}`) : undefined;
  const selectedBlock = current ? blocked(current) : null;

  return (
    <div ref={root} className="overflow-hidden rounded-xl bg-card">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => goTo(at - 1)}
            disabled={at <= 0}
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h2 className="min-w-[10rem] text-center text-lg leading-none font-medium" aria-live="polite">
            {monthLabel(month)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => goTo(at + 1)}
            disabled={at === -1 || at >= months.length - 1}
            aria-label="Next month"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        {sent ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockIcon className="size-3.5" /> Confirmed — read-only
          </p>
        ) : (
          <Legend />
        )}
      </div>
      {summary}

      <p className="sr-only">
        Select a day, then type hours up to {MAX_SESSION_HOURS} and press Enter, or press T, S or H
        for tutor absent, student absent or holiday. Backspace clears. Arrow keys move by day and
        week.
      </p>

      <div className="grid grid-cols-7 border-b bg-muted/40" aria-hidden>
        {WEEKDAY_SHORT.map((day) => (
          <div key={day} className="py-1.5 text-center text-[11px] font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: leading }, (_, i) => (
          <div key={`lead-${i}`} className="border-r border-b bg-muted/30" />
        ))}

        {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
          const date = dateKey(month, day);
          const e = index.get(`${student.id}:${date}`);
          const isScheduled = scheduled.has(date);
          const isUnlogged = missing.has(date);
          const isDismissed = dismissed.has(date) && !e;
          const isSelected = current === date;
          const isDraft = isSelected && draft !== null;
          const future = date > today;
          const outOfRange = !enrolledOn(student, date);

          const state = e
            ? e.code
              ? ABSENCE_LABEL[e.code]
              : `${formatHours(e.hours ?? 0)} hours`
            : isUnlogged
              ? "unlogged scheduled day"
              : isDismissed
                ? "scheduled, nothing to record"
                : isScheduled
                ? "scheduled"
                : "empty";

          return (
            <button
              key={date}
              data-day={date}
              ref={(el) => {
                if (el) cells.current.set(date, el);
                else cells.current.delete(date);
              }}
              type="button"
              tabIndex={(current ?? dateKey(month, 1)) === date ? 0 : -1}
              aria-label={`${formatDate(date)}: ${state}`}
              aria-pressed={isSelected}
              onClick={(ev) => {
                select(date);
                // Safari does not focus buttons on click; the keys need focus.
                ev.currentTarget.focus();
              }}
              onFocus={() => current !== date && select(date)}
              onBlur={() => isDraft && commitHours(date, draft ?? "")}
              onKeyDown={(ev) => onKeyDown(ev, date)}
              className={cn(
                "relative flex h-[56px] flex-col items-center justify-center border-r border-b p-1 outline-none transition-colors",
                "bg-input-surface hover:bg-lime/30",
                outOfRange && !e && "opacity-40",
                future && "cursor-default",
                date === today && !isSelected && "ring-1 ring-primary ring-inset",
                isSelected && "z-10 bg-lime/50 ring-2 ring-primary ring-inset hover:bg-lime/50",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 left-1.5 text-[11px] tabular-nums",
                  isSelected || date === today ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {day}
              </span>
              {isScheduled && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary/50"
                />
              )}
              {isUnlogged && !isSelected && (
                // A soft outline, not an error: the tutor may know there was nothing.
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1.5 top-5 bottom-1.5 rounded-md border border-dashed border-foreground/25"
                />
              )}

              {isDraft ? (
                <span className="flex items-center gap-0.5 text-lg font-semibold text-primary tabular-nums">
                  {draft}
                  <Caret />
                </span>
              ) : isSelected && !blocked(date) ? (
                // The caret marks the day the next keystroke lands in.
                <span className="flex items-center gap-0.5">
                  {e?.code ? (
                    <span className="rounded-sm bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                      {e.code}
                    </span>
                  ) : e?.hours ? (
                    <span className="text-lg font-semibold tabular-nums">{formatHours(e.hours)}</span>
                  ) : null}
                  <Caret />
                </span>
              ) : e?.code ? (
                <span className="rounded-sm bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {e.code}
                </span>
              ) : e?.hours ? (
                <span className="text-lg font-semibold tabular-nums">{formatHours(e.hours)}</span>
              ) : isUnlogged ? (
                <span className="text-[11px] text-muted-foreground">unlogged</span>
              ) : isDismissed ? (
                <span className="text-[11px] text-muted-foreground/70">—</span>
              ) : null}
            </button>
          );
        })}

        {Array.from({ length: trailing }, (_, i) => (
          <div key={`trail-${i}`} className="border-r border-b bg-muted/30" />
        ))}
      </div>

      {editorTarget ? (
        createPortal(
          <DayPanel
            student={student}
            sent={sent}
            entry={entry}
            onPick={(date) => select(date)}
            date={current}
            message={message}
            blockedReason={selectedBlock}
            state={current ? dayState(current) : null}
          >
            {current && !selectedBlock && (
              <DayEditor
                key={current}
                stacked
                date={current}
                entry={entry}
                dismissal={
                  missing.has(current) ? "dismiss" : dismissed.has(current) && !entry ? "undo" : null
                }
                onDismiss={(undo) => {
                  onDismiss(current, undo);
                  cells.current.get(current)?.focus();
                }}
                onHours={(hours) => write(current, { hours })}
                onCode={(code) => write(current, { code })}
                onClear={() => clear(current)}
                onDone={() => cells.current.get(current)?.focus()}
              />
            )}
          </DayPanel>,
          editorTarget,
        )
      ) : (
      <div data-day-editor className="min-h-[52px] px-3 py-2.5 text-sm">
          {message ? (
            <p role="status" className="font-medium text-destructive">
              {message}
            </p>
          ) : !current ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Pick a day, then type hours and <Kbd>↵</Kbd>, or <Kbd>T</Kbd> tutor absent{" "}
              <Kbd>S</Kbd> student absent <Kbd>H</Kbd> holiday <Kbd>⌫</Kbd> clear. Arrows move.
            </p>
          ) : selectedBlock ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{formatDate(current)}</span> ·{" "}
              {selectedBlock}
            </p>
          ) : (
            <DayEditor
              key={current}
              date={current}
              entry={entry}
              dismissal={
                missing.has(current) ? "dismiss" : dismissed.has(current) && !entry ? "undo" : null
              }
              onDismiss={(undo) => {
                onDismiss(current, undo);
                cells.current.get(current)?.focus();
              }}
              onHours={(hours) => write(current, { hours })}
              onCode={(code) => write(current, { code })}
              onClear={() => clear(current)}
              onDone={() => cells.current.get(current)?.focus()}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** The side panel: a prompt until a day is picked, then that day's editor. */
function DayPanel({
  student,
  sent,
  entry,
  onPick,
  date,
  message,
  blockedReason,
  state,
  children,
}: {
  student: Student;
  sent: boolean;
  entry: SessionEntry | undefined;
  /** Selects a day on the calendar, e.g. the one just logged. */
  onPick: (date: string) => void;
  date: string | null;
  message: string | null;
  blockedReason: string | null;
  state: string | null;
  children: React.ReactNode;
}) {
  const { setEntryNote } = useStore();
  const today = todayISO();
  // "Log a session" opens for the picked day, or today with nothing picked;
  // picking another day closes it.
  const [loggingFor, setLoggingFor] = useState<string | null>(null);
  const logDate = date ?? today;
  const canLog = logDate <= today && !blockedReason;
  const logButton = canLog && (
    <Button
      variant="ghost"
      size="xs"
      className="-mr-2 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => setLoggingFor(logDate)}
    >
      <PlusIcon /> Log a session
    </Button>
  );

  if (loggingFor !== null && loggingFor === logDate) {
    return (
      <LogSessionForm
        key={logDate}
        students={[student]}
        date={logDate}
        onBack={() => setLoggingFor(null)}
        onCancel={() => setLoggingFor(null)}
        onLogged={() => {
          setLoggingFor(null);
          onPick(logDate);
        }}
      />
    );
  }

  if (!date) {
    return (
      <div className="flex h-full flex-col gap-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">Day</h2>
          {logButton}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-foreground/15 px-4 py-10 text-center">
          <p className="font-medium">Select a day on the calendar</p>
          <p className="text-xs text-muted-foreground">
            to log a session, or to change one already logged.
          </p>
          <p className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
            Or type hours and <Kbd>↵</Kbd> · <Kbd>T</Kbd> <Kbd>S</Kbd> <Kbd>H</Kbd> · <Kbd>⌫</Kbd> clears ·
            arrows move
          </p>
        </div>
      </div>
    );
  }
  return (
    // Wide enough, the day's controls and note sit beside its goals.
    <div className="@container space-y-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">{WEEKDAY_SHORT[weekdayOf(date)]}, {formatDate(date)}</h2>
          <SessionWhenWhere key={`${student.id}:${date}`} student={student} date={date} locked={sent} />
          <GroupAppointments student={student} date={date} />
          {state && <p className="text-muted-foreground">{state}</p>}
        </div>
        {logButton}
      </div>
      <div className="grid gap-x-6 gap-y-4 @md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {message ? (
            <p role="status" className="font-medium text-destructive">
              {message}
            </p>
          ) : blockedReason ? (
            <p className="text-muted-foreground">{blockedReason}</p>
          ) : null}
          {children}
          <SessionNote
            key={`${student.id}:${date}`}
            fieldId={`day-note-${student.id}-${date}`}
            note={entry?.note ?? ""}
            logged={Boolean(entry)}
            onSave={(note) => setEntryNote(student.id, date, note)}
          />
        </div>
        {/* Side by side, the goals column drops the rule that separates it when stacked. */}
        <div className="min-w-0 @md:border-l @md:pl-6 @md:[&>section]:border-t-0 @md:[&>section]:pt-0">
          <SessionGoals student={student} date={date} />
        </div>
      </div>
    </div>
  );
}

function Caret() {
  return (
    <span aria-hidden className="h-5 w-px animate-caret-blink bg-primary motion-reduce:animate-none" />
  );
}

function Legend() {
  return (
    <ul className="flex items-center gap-3 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/50" /> Scheduled
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-sm border border-dashed border-foreground/35" /> Unlogged
      </li>
    </ul>
  );
}

/** Mouse route to the same actions the keys perform on a selected day. */
function DayEditor({
  stacked = false,
  date,
  entry,
  dismissal,
  onDismiss,
  onHours,
  onCode,
  onClear,
  onDone,
}: {
  /** One control group per row, for the narrow side panel. */
  stacked?: boolean;
  date: string;
  entry: SessionEntry | undefined;
  /** "dismiss" on an unlogged scheduled day, "undo" on one already dismissed. */
  dismissal: "dismiss" | "undo" | null;
  onDismiss: (undo: boolean) => void;
  onHours: (hours: number) => void;
  onCode: (code: AbsenceCode) => void;
  onClear: () => void;
  onDone: () => void;
}) {
  const [other, setOther] = useState("");
  const value = Number.parseFloat(other);
  const otherOk = !Number.isNaN(value) && value > 0 && value <= MAX_SESSION_HOURS;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-2",
        stacked ? "flex-col items-start gap-y-3" : "items-center",
      )}
    >
      {!stacked && <span className="font-medium">{formatDate(date)}</span>}

      {stacked && <p className="-mb-2 text-xs font-medium text-muted-foreground">Hours held</p>}
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Hours tutored">
        {PRESETS.map((h) => {
          const on = !entry?.code && entry?.hours === h;
          return (
            <Button
              key={h}
              size="xs"
              variant={on ? "secondary" : "ghost"}
              aria-pressed={on}
              className={cn("w-9 tabular-nums", !on && "bg-muted hover:bg-muted-hover")}
              onClick={() => {
                onHours(h);
                onDone();
              }}
            >
              {formatHours(h)}
            </Button>
          );
        })}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!otherOk) return;
            onHours(value);
            setOther("");
            onDone();
          }}
        >
          <Input
            aria-label="Other hours"
            inputMode="decimal"
            placeholder="other"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            aria-invalid={other.trim() && !otherOk ? true : undefined}
            className="h-6 w-16 bg-input-surface px-2 text-xs"
          />
        </form>
      </div>

      {stacked && <p className="-mb-2 text-xs font-medium text-muted-foreground">No session</p>}
      <div className="flex items-center gap-1" role="group" aria-label="No session">
        {ABSENCE_CODES.map((code) => {
          const on = entry?.code === code;
          return (
            <Button
              key={code}
              size="xs"
              variant={on ? "secondary" : "ghost"}
              aria-pressed={on}
              title={ABSENCE_LABEL[code]}
              className={cn(!on && "bg-muted hover:bg-muted-hover")}
              onClick={() => {
                onCode(code);
                onDone();
              }}
            >
              {code}
              <span className="sr-only"> — {ABSENCE_LABEL[code]}</span>
            </Button>
          );
        })}
      </div>

      {entry && (
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            onClear();
            onDone();
          }}
        >
          Clear
        </Button>
      )}

      {dismissal === "dismiss" && (
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onDismiss(false)}
        >
          Nothing to record
        </Button>
      )}
      {dismissal === "undo" && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          Nothing to record for this day.
          <Button size="xs" variant="link" className="h-auto px-0" onClick={() => onDismiss(true)}>
            Undo
          </Button>
        </span>
      )}
    </div>
  );
}
