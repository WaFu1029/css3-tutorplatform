"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import type { AbsenceCode, Entry } from "@/lib/types";
import { ABSENCE_KEYS, ABSENCE_LABEL } from "@/lib/absence";
import {
  addDays,
  dateKey,
  daysInMonth,
  formatDate,
  formatHours,
  MAX_SESSION_HOURS,
  monthKey,
  monthLabel,
  todayISO,
  weekdayOf,
} from "@/lib/fy";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** True for keys that look like an attempt to fill the cell, not to navigate it. */
function isEditingKey(key: string): boolean {
  return key.length === 1 && key !== " ";
}

type Props = {
  months: string[];
  entries: Map<string, Entry>;
  studentId: string;
  startedOn: string;
  stoppedOn: string | null;
  onSet: (date: string, hours: number, code: AbsenceCode | null) => void;
  onClear: (date: string) => void;
};

export function Ledger({
  months,
  entries,
  studentId,
  startedOn,
  stoppedOn,
  onSet,
  onClear,
}: Props) {
  const today = todayISO();
  const currentMonth = monthKey(today);

  // Open on the month in progress when the fiscal year contains it.
  const [index, setIndex] = useState(() => Math.max(0, months.indexOf(currentMonth)));
  const [focus, setFocus] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `focus` is the roving tab stop and survives a click elsewhere; `active` is
  // whether the grid actually holds focus, and it alone drives the selected look.
  const [active, setActive] = useState(false);
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const grid = useRef<HTMLDivElement>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const month = months[index];
  const days = daysInMonth(month);

  const monthTotal = useMemo(() => {
    let hours = 0;
    for (let d = 1; d <= days; d++) {
      hours += entries.get(`${studentId}:${dateKey(month, d)}`)?.hours ?? 0;
    }
    return hours;
  }, [entries, studentId, month, days]);

  const yearTotal = useMemo(() => {
    let hours = 0;
    for (const key of months) {
      for (let d = 1; d <= daysInMonth(key); d++) {
        hours += entries.get(`${studentId}:${dateKey(key, d)}`)?.hours ?? 0;
      }
    }
    return hours;
  }, [entries, studentId, months]);

  useEffect(() => {
    if (active && focus) cells.current.get(focus)?.focus();
  }, [active, focus, index]);

  useEffect(() => () => clearTimeout(errorTimer.current ?? undefined), []);

  /** Shows a message under the grid and clears it once it has been read. */
  function flash(message: string) {
    setError(message);
    clearTimeout(errorTimer.current ?? undefined);
    errorTimer.current = setTimeout(() => setError(null), 4000);
  }

  function clearError() {
    clearTimeout(errorTimer.current ?? undefined);
    setError(null);
  }

  /** Moves focus by whole days, following the cursor into the next month. */
  function move(from: string, delta: number) {
    const next = addDays(from, delta);
    const key = monthKey(next);
    const at = months.indexOf(key);
    if (at === -1) return;
    if (at !== index) setIndex(at);
    setFocus(next);
  }

  function goToMonth(at: number) {
    if (at < 0 || at >= months.length) return;
    setDraft(null);
    setIndex(at);
    setFocus(null);
  }

  function commit(date: string, raw: string) {
    const text = raw.trim();
    setDraft(null);
    if (!text) return;

    const value = Number.parseFloat(text);
    if (Number.isNaN(value)) {
      flash(`"${text}" is not a number of hours.`);
      return;
    }
    if (value <= 0) {
      onClear(date);
      return;
    }
    if (value > MAX_SESSION_HOURS) {
      flash(`A session tops out at ${MAX_SESSION_HOURS} hours, so ${formatHours(value)} was not saved.`);
      return;
    }
    onSet(date, value, null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, date: string) {
    const locked = date > today;

    const step =
      e.key === "ArrowLeft"
        ? -1
        : e.key === "ArrowRight"
          ? 1
          : e.key === "ArrowUp"
            ? -7
            : e.key === "ArrowDown" || e.key === "Enter"
              ? 7
              : 0;

    if (step !== 0) {
      e.preventDefault();
      clearError();
      if (draft !== null) commit(date, draft);
      move(date, step);
      return;
    }
    if (e.key === "Escape") {
      setDraft(null);
      clearError();
      return;
    }
    if (locked) {
      // Typing on a day that has not happened yet is the mistake worth naming.
      if (isEditingKey(e.key)) {
        e.preventDefault();
        flash(`${formatDate(date)} has not happened yet.`);
      }
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      clearError();
      setDraft(null);
      onClear(date);
      return;
    }
    if (/^[0-9.]$/.test(e.key)) {
      e.preventDefault();
      clearError();
      setDraft((prev) => ((prev ?? "") + e.key).slice(0, 4));
      return;
    }
    const code = ABSENCE_KEYS[e.key.toLowerCase()];
    if (code) {
      e.preventDefault();
      clearError();
      setDraft(null);
      onSet(date, 0, code);
      return;
    }
    if (isEditingKey(e.key)) {
      e.preventDefault();
      flash(`"${e.key}" is not an entry. Type hours up to ${MAX_SESSION_HOURS}, or T, S or H.`);
    }
  }

  const leading = weekdayOf(dateKey(month, 1));
  // Pad to whole weeks so the final row keeps the grid's shape.
  const trailing = (7 - ((leading + days) % 7)) % 7;

  return (
    // Borderless card fill, kit rule. The rules inside it are structural — they
    // are what make the month read as the ruled form it replaces.
    <div className="overflow-hidden rounded-xl bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => goToMonth(index - 1)}
            disabled={index === 0}
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h3 className="min-w-[10rem] text-center text-lg leading-none font-medium">
            {monthLabel(month)}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => goToMonth(index + 1)}
            disabled={index === months.length - 1}
            aria-label="Next month"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {formatHours(monthTotal)}
          </span>{" "}
          hours this month
        </p>
      </div>

      <p className="sr-only">
        Hours tutored, one month at a time. Type a number up to {MAX_SESSION_HOURS} to record hours, or
        press T, S or H for
        tutor absent, student absent or holiday. Arrow keys move by day and week.
      </p>

      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center text-[11px] font-semibold text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div ref={grid} className="grid grid-cols-7">
        {Array.from({ length: leading }, (_, i) => (
          <div key={`lead-${i}`} className="border-b border-r bg-muted/30" />
        ))}

        {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
          const date = dateKey(month, day);
          const entry = entries.get(`${studentId}:${date}`);
          const isDraft = draft !== null && focus === date;
          const weekend = [0, 6].includes(weekdayOf(date));
          const isToday = date === today;
          const isSelected = active && focus === date;
          const future = date > today;
          const outOfRange = date < startedOn || (stoppedOn ? date > stoppedOn : false);

          return (
            <button
              key={date}
              ref={(el) => {
                if (el) cells.current.set(date, el);
                else cells.current.delete(date);
              }}
              type="button"
              tabIndex={focus ? (focus === date ? 0 : -1) : day === 1 ? 0 : -1}
              onFocus={() => {
                setFocus(date);
                setActive(true);
              }}
              onBlur={(e) => {
                if (isDraft) commit(date, draft ?? "");
                // Moving between cells keeps the grid selected; leaving it does not.
                const next = e.relatedTarget as Node | null;
                if (!next || !grid.current?.contains(next)) {
                  setActive(false);
                  clearError();
                }
              }}
              onKeyDown={(e) => onKeyDown(e, date)}
              aria-label={`${formatDate(date)}${
                entry
                  ? `: ${
                      entry.code
                        ? ABSENCE_LABEL[entry.code]
                        : `${formatHours(entry.hours)} hours`
                    }`
                  : ": empty"
              }`}
              className={cn(
                "relative flex h-[68px] flex-col items-center justify-center border-b border-r p-1 outline-none transition-colors",
                weekend ? "bg-muted/40" : "bg-input-surface",
                outOfRange && !entry && "opacity-40",
                future ? "cursor-not-allowed" : "cursor-pointer hover:bg-lime/40",
                isToday && !isSelected && "ring-1 ring-inset ring-primary",
                // The selected day is the one the keyboard writes to, so it outranks today.
                isSelected && "z-10 bg-lime/50 ring-2 ring-inset ring-primary hover:bg-lime/50",
              )}
            >
              <span
                className={cn(
                  "absolute left-1.5 top-1 text-[11px] tabular-nums",
                  isToday || isSelected ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {day}
              </span>
              <span className="flex items-center gap-0.5">
                {isDraft ? (
                  <span className="text-lg font-semibold text-primary tabular-nums">{draft}</span>
                ) : entry?.code ? (
                  <span className="text-xs font-medium text-muted-foreground">{entry.code}</span>
                ) : entry && entry.hours > 0 ? (
                  <span className="text-lg font-semibold tabular-nums">
                    {formatHours(entry.hours)}
                  </span>
                ) : null}
                {/* The caret marks the cell the next keystroke lands in. */}
                {isSelected && !future ? (
                  <span
                    aria-hidden
                    className="h-5 w-px animate-caret-blink bg-primary motion-reduce:animate-none"
                  />
                ) : null}
              </span>
            </button>
          );
        })}

        {Array.from({ length: trailing }, (_, i) => (
          <div key={`trail-${i}`} className="border-b border-r bg-muted/30" />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
        <p className={cn("flex flex-wrap items-center gap-1.5", error && "hidden")}>
          Click a day, then type hours.
          <KbdGroup>
            <Kbd>T</Kbd>
          </KbdGroup>
          tutor absent
          <KbdGroup>
            <Kbd>S</Kbd>
          </KbdGroup>
          student absent
          <KbdGroup>
            <Kbd>H</Kbd>
          </KbdGroup>
          holiday
          <KbdGroup>
            <Kbd>⌫</Kbd>
          </KbdGroup>
          clear
        </p>
        <p role="status" aria-live="polite" className="font-medium text-destructive">
          {error}
        </p>
        <p className="text-foreground">
          Year to date{" "}
          <span className="font-semibold tabular-nums">{formatHours(yearTotal)} hours</span>
        </p>
      </div>
    </div>
  );
}
