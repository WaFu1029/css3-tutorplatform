"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { fiscalMonths, fiscalYearLabel, monthKey, monthLabel, todayISO } from "@/lib/fy";
import { CURRENT_FY } from "@/lib/store";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { sheetHref } from "../_lib/report";

export function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field className="w-auto">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
        value={value}
        onValueChange={(next: string | null) => next && onChange(next)}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** The fiscal year (named by its starting year) a YYYY-MM month falls in. */
export function fiscalYearOfMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return m >= 7 ? y : y - 1;
}

/**
 * Year and Month together. The months listed are the chosen fiscal year's;
 * picking another year keeps the same month of the year (Sep → Sep) but
 * never lands past the current month.
 */
export function PeriodPicker({
  years,
  month,
  onChange,
}: {
  /** Fiscal years to offer, newest first. */
  years: number[];
  month: string;
  onChange: (month: string) => void;
}) {
  const fy = fiscalYearOfMonth(month);
  const thisMonth = monthKey(todayISO());
  const months = fiscalMonths(fy).filter((m) => m <= thisMonth || fy < CURRENT_FY);
  const offered = years.includes(fy) ? years : [fy, ...years];

  return (
    <>
      <FilterSelect
        id="report-year"
        label="Year"
        value={String(fy)}
        options={offered.map((y) => ({ value: String(y), label: fiscalYearLabel(y) }))}
        onChange={(value) => {
          const at = fiscalMonths(fy).indexOf(month);
          const next = fiscalMonths(Number(value))[Math.max(0, at)];
          onChange(next > thisMonth ? thisMonth : next);
        }}
      />
      <FilterSelect
        id="report-month"
        label="Month"
        value={month}
        options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
        onChange={onChange}
      />
    </>
  );
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-2xl font-semibold tabular-nums", accent && "text-primary")}>
        {value}
      </dd>
    </div>
  );
}

/** A starred goal keeps the paper form's asterisk. */
export function GoalLabel({ label, starred }: { label: string; starred: boolean }) {
  return (
    <>
      {starred && (
        <span aria-label="starred" className="mr-0.5 text-primary">
          *
        </span>
      )}
      {label}
    </>
  );
}

/** What a "don't ask again" covers: opening/printing sheets, or the CSV export. */
export type GuardKind = "sheet" | "export";

const SKIP_EVENT = "lvaep:unconfirmed-skip";
const skipKey = (kind: GuardKind) => `lvaep.skipUnconfirmed.${kind}`;

/**
 * "Don't ask me again" lives in this browser only: it's one viewer's
 * convenience, not a setting anyone else should inherit. Storage can be
 * blocked, in which case the warning simply keeps asking.
 */
function isSkipped(kind: GuardKind): boolean {
  try {
    return window.localStorage.getItem(skipKey(kind)) === "1";
  } catch {
    return false;
  }
}

function setSkipped(kind: GuardKind, on: boolean) {
  try {
    if (on) window.localStorage.setItem(skipKey(kind), "1");
    else window.localStorage.removeItem(skipKey(kind));
  } catch {
    // Not saved; the warning keeps asking.
  }
  window.dispatchEvent(new Event(SKIP_EVENT));
}

/**
 * Staff asking before they read a sheet, or export numbers, that a tutor
 * hasn't confirmed yet: the figures may still change. `guard(message, go)`
 * runs `go` straight away when `message` is null or the viewer chose not to
 * be asked for that kind, otherwise after the popup's "anyway". Render
 * `dialog` once.
 */
export function useUnconfirmedGuard() {
  const [pending, setPending] = useState<{
    kind: GuardKind;
    title: string;
    body: string;
    action: string;
    go: () => void;
  } | null>(null);
  const [remember, setRemember] = useState(false);

  function guard(
    message: { kind: GuardKind; title: string; body: string; action: string } | null,
    go: () => void,
  ) {
    if (!message || isSkipped(message.kind)) return go();
    setRemember(false);
    setPending({ ...message, go });
  }

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open: boolean) => !open && setPending(null)}>
      <AlertDialogContent>
        {pending && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{pending.title}</AlertDialogTitle>
              <AlertDialogDescription>{pending.body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:items-center">
              {/* Saved only with the "anyway" choice; Cancel never remembers. */}
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:mr-auto">
                <Checkbox checked={remember} onCheckedChange={(on: boolean) => setRemember(on)} />
                Don&apos;t ask me again
              </label>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                autoFocus
                onClick={() => {
                  if (remember) setSkipped(pending.kind, true);
                  pending.go();
                  setPending(null);
                }}
              >
                {pending.action}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guard, dialog };
}

/** Shown once any warning has been switched off in this browser: turns them back on. */
export function RestoreWarningsLink() {
  const [off, setOff] = useState(() => isSkipped("sheet") || isSkipped("export"));
  useEffect(() => {
    const sync = () => setOff(isSkipped("sheet") || isSkipped("export"));
    window.addEventListener(SKIP_EVENT, sync);
    return () => window.removeEventListener(SKIP_EVENT, sync);
  }, []);
  if (!off) return null;
  return (
    <button
      type="button"
      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      onClick={() => {
        setSkipped("sheet", false);
        setSkipped("export", false);
      }}
    >
      Show unconfirmed warnings again
    </button>
  );
}

/**
 * Open / Print for a student's year sheet, or, given `month`, that month's
 * sheet. For a month sheet, `unconfirmed` holds that month when the tutor
 * hasn't confirmed it, and a popup asks before opening.
 */
export function SheetLinks({
  studentId,
  name,
  month,
  unconfirmed = [],
  fy,
}: {
  studentId: string;
  name: string;
  month?: string;
  unconfirmed?: string[];
  /** For a year sheet: which fiscal year. */
  fy?: number;
}) {
  const router = useRouter();
  const { guard, dialog } = useUnconfirmedGuard();
  const linkClass =
    "underline decoration-border underline-offset-2 hover:decoration-foreground";
  const which = month ? `${monthLabel(month)} sheet` : "year sheet";
  const first = name.split(" ")[0];

  // Only a month sheet asks: a year sheet always spans months still in
  // progress, so a warning there would fire every time and mean nothing.
  function message(verb: "Open" | "Print") {
    if (!month || unconfirmed.length === 0) return null;
    return {
      kind: "sheet" as const,
      title: `${first}'s ${monthLabel(month)} isn't confirmed`,
      body: `The tutor hasn't confirmed ${first}'s ${monthLabel(month)} yet, so its hours and notes may still change.`,
      action: `${verb} anyway`,
    };
  }

  function open(e: React.MouseEvent, print: boolean) {
    const msg = message(print ? "Print" : "Open");
    if (!msg) return; // Nothing to ask: the link does its usual thing.
    e.preventDefault();
    const href = sheetHref(studentId, print, month, fy);
    guard(msg, () => (print ? window.open(href, "_blank") : router.push(href)));
  }

  return (
    <span className="flex gap-3 text-sm whitespace-nowrap">
      {dialog}
      <Link
        href={sheetHref(studentId, false, month, fy)}
        className={linkClass}
        aria-label={`Open ${name}'s ${which}`}
        onClick={(e) => open(e, false)}
      >
        Open
      </Link>
      <Link
        href={sheetHref(studentId, true, month, fy)}
        target="_blank"
        className={linkClass}
        aria-label={`Print ${name}'s ${which}`}
        onClick={(e) => open(e, true)}
      >
        Print
      </Link>
    </span>
  );
}
