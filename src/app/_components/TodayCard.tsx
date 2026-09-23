"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheckIcon, UsersIcon } from "lucide-react";
import type { AbsenceCode, Group, Student } from "@/lib/types";
import { ABSENCE_CODES, ABSENCE_LABEL } from "@/lib/absence";
import { addDays, formatDate, formatHours, monthKey, monthLabel, todayISO } from "@/lib/fy";
import {
  entryOn,
  groupSlotOn,
  isMonthSent,
  ledgerOf,
  recentUnlogged,
  scheduledHours,
  slotsOn,
} from "@/lib/logic";
import { formatSlotTime, WEEKDAY_SHORT } from "@/lib/schedule";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupSessionForm, membersOn } from "@/components/GroupSessionForm";
import { UnloggedDayActions } from "@/components/UnloggedDayActions";

/** How far back "Earlier this week" looks, not counting today. */
const LOOKBACK_DAYS = 6;

type Item =
  | { kind: "student"; date: string; student: Student }
  | { kind: "group"; date: string; group: Group; members: Student[] };

/**
 * Today's scheduled sessions, each loggable in one tap, and below them any
 * scheduled day from the past week still unlogged, until it's logged or
 * dismissed. A group's meeting is one item that opens a row per member.
 */
export function TodayCard({ students, groups }: { students: Student[]; groups: Group[] }) {
  const { db } = useStore();
  const today = todayISO();
  const ledger = ledgerOf(db);

  const todays: Item[] = [
    ...students
      .filter((s) => slotsOn(s, today).length > 0)
      .map((student): Item => ({ kind: "student", date: today, student })),
    ...groups
      .filter((g) => groupSlotOn(g, today) && membersOn(g, students, today).length > 0)
      .map((group): Item => ({ kind: "group", date: today, group, members: membersOn(group, students, today) })),
  ].sort((a, b) => startTime(a).localeCompare(startTime(b)));

  // Unlogged days are per student; a day owed through a group becomes one
  // group item listing only the members still unlogged.
  const from = addDays(today, -LOOKBACK_DAYS);
  const earlier = new Map<string, Item>();
  for (const student of students) {
    for (const date of recentUnlogged(student, from, ledger, today)) {
      const slots = slotsOn(student, date, db.groups);
      const viaGroup = slots.find((s) => s.group)?.group;
      if (slots.some((s) => !s.group) || !viaGroup) {
        earlier.set(`${student.id}:${date}`, { kind: "student", date, student });
      } else {
        const key = `${viaGroup.id}:${date}`;
        const item = earlier.get(key);
        if (item?.kind === "group") item.members.push(student);
        else earlier.set(key, { kind: "group", date, group: viaGroup, members: [student] });
      }
    }
  }
  const past = [...earlier.values()].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Today</CardTitle>
        <CardDescription>{formatDate(today)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {todays.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheckIcon className="size-4" />
            Nothing on the schedule today. {nextSession(students, groups, today) ?? ""}
          </p>
        ) : (
          <ul className="divide-y">
            {todays.map((item) =>
              item.kind === "student" ? (
                <TodayStudent key={item.student.id} student={item.student} />
              ) : (
                <GroupItem key={item.group.id} item={item} />
              ),
            )}
          </ul>
        )}

        {past.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">Earlier this week</h3>
            <ul className="divide-y">
              {past.map((item) =>
                item.kind === "student" ? (
                  <li
                    key={`${item.student.id}:${item.date}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
                  >
                    <p className="text-sm">
                      <span className="font-medium">{dayName(item.date)}</span>{" "}
                      <span className="text-muted-foreground">with</span> {item.student.name}
                    </p>
                    <UnloggedDayActions student={item.student} date={item.date} />
                  </li>
                ) : (
                  <GroupItem key={`${item.group.id}:${item.date}`} item={item} past />
                ),
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function startTime(item: Item): string {
  if (item.kind === "group") return groupSlotOn(item.group, item.date)?.startTime ?? "";
  return slotsOn(item.student, item.date)[0]?.slot.startTime ?? "";
}

/** "Thu, Sep 17". */
function dayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAY_SHORT[new Date(y, m - 1, d).getDay()]}, ${formatDate(date).replace(/, \d{4}$/, "")}`;
}

function TodayStudent({ student }: { student: Student }) {
  const { db, saveEntries, clearEntry, reopenMonth } = useStore();
  const today = todayISO();
  const month = monthKey(today);
  const slot = slotsOn(student, today)[0].slot;
  const hours = scheduledHours(student, today)!;
  const entry = entryOn(db.entries, student.id, today);
  const sent = isMonthSent(db.reports, student.id, month);

  function log(value: { hours: number } | { code: AbsenceCode }) {
    saveEntries([student.id], today, value);
    toast.success(
      "code" in value ? `${ABSENCE_LABEL[value.code]} recorded` : `${formatHours(value.hours)} hours saved`,
      { description: `${student.name} · today` },
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{student.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSlotTime(slot)} · {student.site}
        </p>
      </div>

      {sent ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {monthLabel(month).split(" ")[0]} is confirmed.
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => reopenMonth(student.id, month)}>
            Reopen
          </Button>
        </div>
      ) : entry ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">
            {entry.code ? ABSENCE_LABEL[entry.code] : `Held · ${formatHours(entry.hours)} h`}
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-muted-foreground"
            onClick={() => clearEntry(student.id, today)}
          >
            Undo
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={() => log({ hours })}>
            Held · {formatHours(hours)} h
          </Button>
          {ABSENCE_CODES.map((code) => (
            <Button
              key={code}
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => log({ code })}
            >
              {ABSENCE_LABEL[code]}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

/** A group meeting: one line that opens the per-member rows. */
function GroupItem({ item, past }: { item: Extract<Item, { kind: "group" }>; past?: boolean }) {
  const { db, dismissDay, undismissDay } = useStore();
  const [open, setOpen] = useState(false);
  const { group, date, members } = item;
  const slot = groupSlotOn(group, date);
  const logged = members.filter((s) => entryOn(db.entries, s.id, date)).length;

  function dismissAll() {
    for (const s of members) dismissDay(s.id, date);
    toast("Nothing to record", {
      description: `${group.name} · ${formatDate(date)}`,
      action: { label: "Undo", onClick: () => members.forEach((s) => undismissDay(s.id, date)) },
    });
  }

  return (
    <li className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm">
            <UsersIcon className="size-3.5 text-muted-foreground" />
            {past && <span className="font-medium">{dayName(date)}</span>}
            {past && <span className="text-muted-foreground">with</span>}
            <span className="font-medium">{group.name}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {slot ? `${formatSlotTime(slot)} · ` : ""}
            {members.map((s) => s.name.split(" ")[0]).join(", ")}
            {!past && logged > 0 && ` · ${logged} of ${members.length} logged`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant={open ? "secondary" : "default"} onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : logged === members.length && !past ? "Edit" : "Log session"}
          </Button>
          {past && (
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={dismissAll}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
      {open && <GroupSessionForm group={group} date={date} onSaved={() => setOpen(false)} />}
    </li>
  );
}

/** "Next: Luis on Sat, Sep 26." within the coming two weeks, else null. */
function nextSession(students: Student[], groups: Group[], today: string): string | null {
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i);
    const who = [
      ...students.filter((s) => slotsOn(s, date).length).map((s) => s.name.split(" ")[0]),
      ...groups.filter((g) => groupSlotOn(g, date)).map((g) => g.name),
    ];
    if (who.length) return `Next: ${who.join(", ")} on ${formatDate(date)}.`;
  }
  return null;
}
