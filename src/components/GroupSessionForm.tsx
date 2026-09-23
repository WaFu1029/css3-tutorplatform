"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import type { Group, Student } from "@/lib/types";
import { ABSENCE_LABEL } from "@/lib/absence";
import { formatDate, formatHours, MAX_SESSION_HOURS, monthKey, monthLabel } from "@/lib/fy";
import { enrolledOn, entryOn, groupSlotOn, isMonthSent, lastSessionHours, memberOn } from "@/lib/logic";
import { slotHours } from "@/lib/schedule";
import { useStore, type SaveLine } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const CHIP =
  "border-transparent bg-muted hover:bg-muted-hover data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground data-[pressed]:hover:bg-secondary";

type Line = { present: boolean; hours: string };
type Whole = "TA" | "H" | null;

/** The members a group session is for on a date: those in the group and enrolled that day. */
export function membersOn(group: Group, students: Student[], date: string): Student[] {
  return students.filter((s) => memberOn(group, s.id, date) && enrolledOn(s, date));
}

/**
 * A row per member for one group meeting. Everyone starts Present with the
 * group's scheduled hours; each row can switch to Student absent or take
 * other hours. Tutor absent and Holiday cover the whole group. Saving writes
 * one entry per member with a shared groupId.
 *
 * Remount it (key on group and date) when either changes.
 */
export function GroupSessionForm({
  group,
  date,
  disabled,
  onSaved,
}: {
  group: Group;
  date: string;
  /** Set by a parent that has its own reason not to save (e.g. a future date). */
  disabled?: boolean;
  onSaved?: () => void;
}) {
  const { db, saveSession, reopenMonth } = useStore();
  const members = membersOn(group, db.students, date);
  const month = monthKey(date);
  const slot = groupSlotOn(group, date);

  const [whole, setWhole] = useState<Whole>(() => {
    const codes = members.map((s) => entryOn(db.entries, s.id, date)?.code);
    const first = codes[0];
    return (first === "TA" || first === "H") && codes.every((c) => c === first) ? first : null;
  });
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(
      members.map((s) => {
        const e = entryOn(db.entries, s.id, date);
        const usual = slot ? slotHours(slot) : (lastSessionHours(db.entries, s.id) ?? 1);
        return [
          s.id,
          e?.code === "SA"
            ? { present: false, hours: String(usual) }
            : { present: true, hours: String(e?.hours ?? usual) },
        ];
      }),
    ),
  );

  const locked = members.filter((s) => isMonthSent(db.reports, s.id, month));
  const logged = members.filter((s) => entryOn(db.entries, s.id, date));

  const errors = Object.fromEntries(
    members.map((s) => {
      const line = lines[s.id];
      if (whole || !line?.present) return [s.id, null];
      const h = Number.parseFloat(line.hours);
      return [
        s.id,
        Number.isNaN(h) || h <= 0
          ? "Hours?"
          : h > MAX_SESSION_HOURS
            ? `Max ${MAX_SESSION_HOURS}`
            : null,
      ];
    }),
  );
  const valid = members.length > 0 && Object.values(errors).every((e) => !e);

  function patch(id: string, next: Partial<Line>) {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }

  function save() {
    const out: SaveLine[] = members.map((s) => ({
      studentId: s.id,
      value: whole
        ? { code: whole }
        : lines[s.id].present
          ? { hours: Number.parseFloat(lines[s.id].hours) }
          : { code: "SA" },
    }));
    const { saved } = saveSession(date, out);
    if (!saved.length) return;
    const absent = out.filter((l) => "code" in l.value && l.value.code === "SA").length;
    toast.success(`${group.name} saved`, {
      description: `${formatDate(date)} · ${
        whole ? ABSENCE_LABEL[whole] : `${saved.length - absent} present${absent ? `, ${absent} absent` : ""}`
      }`,
    });
    onSaved?.();
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No one was in {group.name} on {formatDate(date)}.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Whole group:</span>
        <ToggleGroup
          value={whole ? [whole] : []}
          onValueChange={(v: string[]) => setWhole((v[0] as Whole) ?? null)}
          aria-label="Whole group did not meet"
        >
          {(["TA", "H"] as const).map((code) => (
            <ToggleGroupItem key={code} value={code} size="sm" className={CHIP}>
              {ABSENCE_LABEL[code]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <ul className={cn("divide-y rounded-md border bg-background", whole && "opacity-50")}>
        {members.map((s) => {
          const line = lines[s.id];
          const error = errors[s.id];
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
              <span className="min-w-[8rem] flex-1 text-sm font-medium">{s.name}</span>
              <ToggleGroup
                value={[line.present ? "present" : "SA"]}
                onValueChange={(v: string[]) => v[0] && patch(s.id, { present: v[0] === "present" })}
                disabled={Boolean(whole)}
                aria-label={`${s.name} attendance`}
              >
                <ToggleGroupItem value="present" size="sm" className={CHIP}>
                  Present
                </ToggleGroupItem>
                <ToggleGroupItem value="SA" size="sm" className={CHIP}>
                  Student absent
                </ToggleGroupItem>
              </ToggleGroup>
              <span className="flex items-center gap-1.5">
                <Input
                  aria-label={`${s.name} hours`}
                  inputMode="decimal"
                  value={line.present ? line.hours : ""}
                  placeholder="—"
                  disabled={!line.present || Boolean(whole)}
                  onChange={(e) => patch(s.id, { hours: e.target.value })}
                  aria-invalid={error ? true : undefined}
                  className="h-8 w-16 bg-input-surface tabular-nums"
                />
                <span className="w-12 text-xs text-muted-foreground">{error ?? "hours"}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {locked.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {monthLabel(month)} is already confirmed for {locked.map((s) => s.name.split(" ")[0]).join(", ")}; they
          won&apos;t be saved.
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => locked.forEach((s) => reopenMonth(s.id, month))}
          >
            Reopen
          </Button>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {slot
            ? `Scheduled ${formatHours(slotHours(slot))} h`
            : "Not a scheduled day for this group; hours from each member's last session"}
          {logged.length > 0 && ` · already logged for ${logged.length}, saving updates them`}
        </p>
        <Button onClick={save} disabled={disabled || !valid || locked.length === members.length}>
          {logged.length ? "Update" : "Save"} group session
        </Button>
      </div>
    </div>
  );
}
