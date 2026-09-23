"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCheckIcon } from "lucide-react";
import type { Student } from "@/lib/types";
import { formatDate, formatHours, MONTH_NAMES } from "@/lib/fy";
import { hoursInMonth, ledgerOf, sendCheck, type SendCheck } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UnloggedDayActions } from "@/components/UnloggedDayActions";

function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5)) - 1];
}

/** The review's questions for one student, in the words the office asked for. */
function questions(check: SendCheck, month: string): string[] {
  const name = monthName(month);
  return [
    check.notOver && `${name} isn't over yet. Confirm anyway?`,
    check.noSchedule && `Is everything for ${name} logged?`,
    check.noSessions && `No sessions logged for ${name}. Confirm anyway?`,
  ].filter((q): q is string => Boolean(q));
}

/**
 * Sends one student's month. Straight away when there is nothing to ask;
 * otherwise through the review first. Never refuses.
 */
export function SendMonthButton({
  student,
  month,
  children,
  ...buttonProps
}: {
  student: Student;
  month: string;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const { db, sendMonth } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        {...buttonProps}
        onClick={() => {
          if (sendCheck(student, month, ledgerOf(db)).clean) {
            sendMonth(student.id, month);
            toast.success(`${monthName(month)} confirmed`, {
              description: `${student.name} · ${formatHours(hoursInMonth(db.entries, student.id, month))} hours`,
            });
          } else {
            setOpen(true);
          }
        }}
      >
        {children ?? `Confirm ${monthName(month)}`}
      </Button>
      <SendReviewDialog open={open} onOpenChange={setOpen} students={[student]} month={month} />
    </>
  );
}

/** "Send all": always reviewed, one combined list across students. */
export function SendAllButton({
  students,
  month,
  ...buttonProps
}: {
  students: Student[];
  month: string;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "children">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...buttonProps} disabled={students.length === 0} onClick={() => setOpen(true)}>
        <CheckCheckIcon /> Confirm all ({students.length})
      </Button>
      <SendReviewDialog open={open} onOpenChange={setOpen} students={students} month={month} />
    </>
  );
}

/**
 * Lists what might be missing before a month goes to the office, with quick
 * answers for each unlogged day. The tutor decides; "Send anyway" always works.
 */
export function SendReviewDialog({
  open,
  onOpenChange,
  students,
  month,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  month: string;
}) {
  const { db, sendMonth } = useStore();
  const name = monthName(month);
  const ledger = ledgerOf(db);
  const checks = students.map((student) => ({ student, check: sendCheck(student, month, ledger) }));
  const anything = checks.some((c) => !c.check.clean);
  const many = students.length > 1;

  function send() {
    for (const s of students) sendMonth(s.id, month);
    toast.success(
      many ? `Confirmed ${students.length} ${name} reports` : `${name} confirmed`,
      { description: many ? students.map((s) => s.name.split(" ")[0]).join(", ") : students[0]?.name },
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {many ? `Confirm ${name} for ${students.length} students` : `Confirm ${students[0]?.name}'s ${name}`}
          </DialogTitle>
          <DialogDescription>
            {anything
              ? "A quick look before you confirm it for the office. Answer what you can, or confirm as it is."
              : "Everything scheduled is logged."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="-mx-1 max-h-[60vh] px-1">
          <ul className="space-y-4">
            {checks.map(({ student, check }) => (
              <li key={student.id} className="space-y-2">
                {many && (
                  <p className="flex items-baseline justify-between gap-2 border-b pb-1">
                    <span className="font-medium">{student.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatHours(hoursInMonth(db.entries, student.id, month))} h
                      {check.clean && " · all logged"}
                    </span>
                  </p>
                )}
                {questions(check, month).map((q) => (
                  <p key={q} className="text-sm">
                    {q}
                  </p>
                ))}
                {check.unlogged.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm text-muted-foreground">
                      {check.unlogged.length} unlogged scheduled day
                      {check.unlogged.length === 1 ? "" : "s"}:
                    </p>
                    <ul className="space-y-1">
                      {check.unlogged.map((date) => (
                        <li
                          key={date}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-foreground/20 py-1 pr-1 pl-2.5"
                        >
                          <span className="text-sm tabular-nums">{formatDate(date)}</span>
                          <UnloggedDayActions student={student} date={date} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={students.length === 0}>
            <CheckCheckIcon />
            {anything ? "Confirm anyway" : many ? `Confirm all (${students.length})` : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
