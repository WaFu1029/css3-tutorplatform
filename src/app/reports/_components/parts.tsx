"use client";

import Link from "next/link";
import { cn } from "cn";
import { monthLabel } from "@/lib/fy";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL, sheetHref, type ReportStatus } from "../_lib/report";

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

export function MonthPicker({
  months,
  value,
  onChange,
}: {
  months: string[];
  value: string;
  onChange: (month: string) => void;
}) {
  return (
    <FilterSelect
      id="report-month"
      label="Month"
      value={value}
      options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
      onChange={onChange}
    />
  );
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const variant = {
    sent: "default",
    ready: "secondary",
    open: "outline",
    upcoming: "ghost",
  } as const;
  return (
    <Badge
      variant={variant[status]}
      className={cn(status === "upcoming" && "text-muted-foreground")}
    >
      {STATUS_LABEL[status]}
    </Badge>
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

export function SheetLinks({ studentId, name }: { studentId: string; name: string }) {
  const linkClass =
    "underline decoration-border underline-offset-2 hover:decoration-foreground";
  return (
    <span className="flex gap-3 text-sm whitespace-nowrap">
      <Link href={sheetHref(studentId)} className={linkClass} aria-label={`Open ${name}'s year sheet`}>
        Open
      </Link>
      <Link
        href={sheetHref(studentId, true)}
        target="_blank"
        className={linkClass}
        aria-label={`Print ${name}'s year sheet`}
      >
        Print
      </Link>
    </span>
  );
}
