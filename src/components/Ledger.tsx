"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import type { AbsenceCode, Entry } from "@/lib/types";
import {
  FY_MONTHS,
  dateKey,
  daysInMonth,
  formatDate,
  formatHours,
  todayISO,
  weekdayOf,
} from "@/lib/fy";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const CODE_KEYS: Record<string, AbsenceCode> = { t: "TA", s: "SA", h: "H" };

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
  const currentMonth = today.slice(0, 7);
  const [focus, setFocus] = useState<{ m: number; d: number } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const totals = useMemo(
    () =>
      months.map((month) => {
        let hours = 0;
        for (let d = 1; d <= daysInMonth(month); d++) {
          hours += entries.get(`${studentId}:${dateKey(month, d)}`)?.hours ?? 0;
        }
        return hours;
      }),
    [months, entries, studentId],
  );

  const yearTotal = totals.reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!focus) return;
    cells.current.get(`${focus.m}:${focus.d}`)?.focus();
  }, [focus]);

  function exists(m: number, d: number) {
    return m >= 0 && m < months.length && d >= 1 && d <= daysInMonth(months[m]);
  }

  function move(m: number, d: number) {
    if (exists(m, d)) setFocus({ m, d });
  }

  function commit(m: number, d: number, raw: string) {
    const date = dateKey(months[m], d);
    const value = Number.parseFloat(raw);
    if (!raw.trim() || Number.isNaN(value) || value <= 0) onClear(date);
    else onSet(date, Math.min(value, 24), null);
    setDraft(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, m: number, d: number) {
    const date = dateKey(months[m], d);
    const locked = date > today;

    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      if (draft !== null) commit(m, d, draft);
      move(m, d + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (draft !== null) commit(m, d, draft);
      move(m, d - 1);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      if (draft !== null) commit(m, d, draft);
      move(m + (e.key === "ArrowLeft" ? -1 : 1), d);
      return;
    }
    if (e.key === "Escape") {
      setDraft(null);
      return;
    }
    if (locked) return;

    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      setDraft(null);
      onClear(date);
      return;
    }
    if (/^[0-9.]$/.test(e.key)) {
      e.preventDefault();
      setDraft((prev) => ((prev ?? "") + e.key).slice(0, 4));
      return;
    }
    const code = CODE_KEYS[e.key.toLowerCase()];
    if (code) {
      e.preventDefault();
      setDraft(null);
      onSet(date, 0, code);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="border-collapse text-[13px]">
        <TableCaption className="sr-only">
          Hours tutored by day and month. Type a number to record hours, or press T, S or H for
          tutor absent, student absent or holiday.
        </TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 h-8 w-9 bg-card p-0" />
            {months.map((month, m) => (
              <TableHead
                key={month}
                className={cn(
                  "h-8 px-1 text-center text-xs font-semibold",
                  month === currentMonth ? "bg-lime text-ink" : "text-muted-foreground",
                )}
              >
                {FY_MONTHS[m]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <TableRow key={day} className="border-0 hover:bg-transparent">
              <TableHead
                scope="row"
                className="sticky left-0 z-10 h-[22px] w-9 border-r bg-card p-0 pr-1 text-right align-middle text-[11px] font-normal text-muted-foreground"
              >
                {day}
              </TableHead>
              {months.map((month, m) => {
                if (day > daysInMonth(month)) {
                  return <TableCell key={month} className="border bg-muted p-0" />;
                }
                const date = dateKey(month, day);
                const entry = entries.get(`${studentId}:${date}`);
                const key = `${m}:${day}`;
                const isDraft = draft !== null && focus?.m === m && focus?.d === day;
                const weekend = [0, 6].includes(weekdayOf(date));
                const isToday = date === today;
                const future = date > today;
                const outOfRange = date < startedOn || (stoppedOn ? date > stoppedOn : false);

                return (
                  <TableCell key={month} className="border p-0">
                    <button
                      ref={(el) => {
                        if (el) cells.current.set(key, el);
                        else cells.current.delete(key);
                      }}
                      type="button"
                      tabIndex={
                        focus
                          ? focus.m === m && focus.d === day
                            ? 0
                            : -1
                          : m === 0 && day === 1
                            ? 0
                            : -1
                      }
                      onFocus={() => setFocus({ m, d: day })}
                      onBlur={() => {
                        if (isDraft) commit(m, day, draft ?? "");
                      }}
                      onKeyDown={(e) => onKeyDown(e, m, day)}
                      aria-label={`${formatDate(date)}${
                        entry
                          ? `: ${entry.code ?? `${formatHours(entry.hours)} hours`}`
                          : ": empty"
                      }`}
                      className={cn(
                        "flex h-[22px] w-full min-w-[46px] items-center justify-center px-1 text-center tabular-nums outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        month === currentMonth
                          ? "bg-lime/15"
                          : weekend
                            ? "bg-muted/70"
                            : "bg-card",
                        outOfRange && !entry && "opacity-40",
                        future ? "cursor-default text-muted-foreground" : "hover:bg-lime/45",
                        isToday && "ring-1 ring-inset ring-ink",
                      )}
                    >
                      {isDraft ? (
                        <span className="font-semibold text-lime-deep">{draft}</span>
                      ) : entry?.code ? (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {entry.code}
                        </span>
                      ) : entry && entry.hours > 0 ? (
                        <span className="font-semibold">{formatHours(entry.hours)}</span>
                      ) : null}
                    </button>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>

        <TableFooter className="bg-ink">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead
              scope="row"
              className="sticky left-0 z-10 h-8 bg-ink p-0 pr-1 text-right text-[11px] text-porcelain"
            >
              Σ
            </TableHead>
            {totals.map((total, m) => (
              <TableCell
                key={months[m]}
                className="h-8 border-l border-white/15 px-1 py-0 text-center text-[13px] font-semibold text-lime tabular-nums"
              >
                {total > 0 ? formatHours(total) : "—"}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center gap-1.5">
          Click a box, then type hours.
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
        <p className="text-foreground">
          Year to date{" "}
          <span className="font-semibold tabular-nums">{formatHours(yearTotal)} hours</span>
        </p>
      </div>
    </div>
  );
}
