"use client";

import { cn } from "cn";
import { FY_MONTHS, formatHours, monthLabel } from "@/lib/fy";

export type MonthState =
  | { kind: "not-started" }
  | { kind: "open"; hours: number; gaps: number }
  | { kind: "sent"; hours: number };

/** July through June; each month is a button that pages the calendar there. */
export function FiscalYearStrip({
  months,
  states,
  active,
  onPick,
}: {
  months: string[];
  states: MonthState[];
  active: string;
  onPick: (month: string) => void;
}) {
  return (
    <nav aria-label="Fiscal year months">
      <ol className="grid grid-cols-6 gap-1 sm:grid-cols-12">
        {months.map((month, i) => {
          const state = states[i];
          const isActive = month === active;
          const label =
            state.kind === "not-started"
              ? "not started"
              : state.kind === "sent"
                ? `${formatHours(state.hours)} hours, sent`
                : `${formatHours(state.hours)} hours, open${
                    state.gaps ? `, ${state.gaps} not logged` : ""
                  }`;

          return (
            <li key={month}>
              <button
                type="button"
                onClick={() => onPick(month)}
                aria-current={isActive ? "date" : undefined}
                aria-label={`${monthLabel(month)}: ${label}`}
                className={cn(
                  "relative flex w-full flex-col items-center rounded-md px-1 py-1.5 text-center transition-colors",
                  state.kind === "sent" && "bg-ink text-lime hover:bg-ink/90",
                  state.kind === "open" && "bg-lime/70 text-ink hover:bg-lime",
                  state.kind === "not-started" &&
                    "bg-muted/60 text-muted-foreground hover:bg-muted",
                  isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                <span className="text-xs font-medium">{FY_MONTHS[i]}</span>
                <span className="text-[11px] tabular-nums opacity-80">
                  {state.kind === "not-started"
                    ? "—"
                    : state.kind === "sent"
                      ? "sent"
                      : `${formatHours(state.hours)} h`}
                </span>
                {state.kind === "open" && state.gaps > 0 && (
                  <span
                    aria-hidden
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
