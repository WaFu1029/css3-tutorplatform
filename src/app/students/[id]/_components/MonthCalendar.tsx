"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, LockIcon } from "lucide-react";
import { cn } from "cn";
import type { AbsenceCode, SessionEntry, Student } from "@/lib/types";
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
import { scheduledDates } from "@/lib/logic";
import { WEEKDAY_SHORT } from "@/lib/schedule";
import { outsideEnrolment } from "../_lib/helpers";

const PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];

type Props = {
  student: Student;
  /** The fiscal year's months; navigation stays inside them. */
  months: string[];
  month: string;
  onMonthChange: (month: string) => void;
  index: Map<string, SessionEntry>;
  /** Unlogged scheduled days, from lib/logic findGaps, so the rule lives in one place. */
  gaps: string[];
  /** A sent month is read-only until it is reopened. */
  sent: boolean;
  onSet: (date: string, value: EntryValue) => void;
  onClear: (date: string) => void;
};

export function MonthCalendar({
  student,
  months,
  month,
  onMonthChange,
  index,
  gaps,
  sent,
  onSet,
  onClear,
}: Props) {
  const today = todayISO();
  const at = months.indexOf(month);
  const days = daysInMonth(month);
  const scheduled = new Set(scheduledDates(student, month));
  const missing = new Set(gaps);
  const monthName = MONTH_NAMES[Number(month.slice(5)) - 1];

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
    if (sent) return `${monthName} is sent to the office. Reopen it to make changes.`;
    if (date > today) return `${formatDate(date)} hasn't happened yet.`;
    return null;
  }

  function write(date: string, value: EntryValue) {
    const reason = blocked(date);
    if (reason) return flash(reason);
    onSet(date, value);
  }

  function clear(date: string) {
    const reason = blocked(date);
    if (reason) return flash(reason);
    onClear(date);
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

  const leading = weekdayOf(dateKey(month, 1));
  const trailing = (7 - ((leading + days) % 7)) % 7;
  const entry = current ? index.get(`${student.id}:${current}`) : undefined;
  const selectedBlock = current ? blocked(current) : null;

  return (
    <div className="overflow-hidden rounded-xl bg-card">
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
            <LockIcon className="size-3.5" /> Sent — read-only
          </p>
        ) : (
          <Legend />
        )}
      </div>

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
          const isGap = missing.has(date);
          const isSelected = current === date;
          const isDraft = isSelected && draft !== null;
          const future = date > today;
          const outOfRange = outsideEnrolment(student, date);

          const state = e
            ? e.code
              ? ABSENCE_LABEL[e.code]
              : `${formatHours(e.hours ?? 0)} hours`
            : isGap
              ? "missing, scheduled day with nothing logged"
              : isScheduled
                ? "scheduled"
                : "empty";

          return (
            <button
              key={date}
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
                "relative flex h-[68px] flex-col items-center justify-center border-r border-b p-1 outline-none transition-colors",
                "bg-input-surface hover:bg-lime/30",
                outOfRange && !e && "opacity-40",
                future && "cursor-default",
                isGap && "bg-destructive/10 hover:bg-destructive/15",
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
                  className={cn(
                    "absolute top-1.5 right-1.5 size-1.5 rounded-full",
                    isGap ? "bg-destructive" : "bg-primary/50",
                  )}
                />
              )}

              {isDraft ? (
                <span className="flex items-center gap-0.5 text-lg font-semibold text-primary tabular-nums">
                  {draft}
                  <span aria-hidden className="h-5 w-px animate-caret-blink bg-primary motion-reduce:animate-none" />
                </span>
              ) : e?.code ? (
                <span className="rounded-sm bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {e.code}
                </span>
              ) : e?.hours ? (
                <span className="text-lg font-semibold tabular-nums">{formatHours(e.hours)}</span>
              ) : isGap ? (
                <span className="text-[11px] font-medium text-destructive">not logged</span>
              ) : null}
            </button>
          );
        })}

        {Array.from({ length: trailing }, (_, i) => (
          <div key={`trail-${i}`} className="border-r border-b bg-muted/30" />
        ))}
      </div>

      <div className="min-h-[52px] px-3 py-2.5 text-sm">
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
            onHours={(hours) => write(current, { hours })}
            onCode={(code) => write(current, { code })}
            onClear={() => clear(current)}
            onDone={() => cells.current.get(current)?.focus()}
          />
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex items-center gap-3 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-primary/50" /> Scheduled
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-sm bg-destructive/15" /> Not logged
      </li>
    </ul>
  );
}

/** Mouse route to the same actions the keys perform on a selected day. */
function DayEditor({
  date,
  entry,
  onHours,
  onCode,
  onClear,
  onDone,
}: {
  date: string;
  entry: SessionEntry | undefined;
  onHours: (hours: number) => void;
  onCode: (code: AbsenceCode) => void;
  onClear: () => void;
  onDone: () => void;
}) {
  const [other, setOther] = useState("");
  const value = Number.parseFloat(other);
  const otherOk = !Number.isNaN(value) && value > 0 && value <= MAX_SESSION_HOURS;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="font-medium">{formatDate(date)}</span>

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
    </div>
  );
}
