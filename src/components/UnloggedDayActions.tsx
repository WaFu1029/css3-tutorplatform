"use client";

import { toast } from "sonner";
import type { Student } from "@/lib/types";
import { ABSENCE_CODES, ABSENCE_LABEL } from "@/lib/absence";
import { formatDate, formatHours } from "@/lib/fy";
import { heldHours, ledgerOf } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const QUIET = "bg-background hover:bg-muted";

/**
 * One-tap answers for an unlogged scheduled day: it was held, someone was
 * absent, it was a holiday, or there's nothing to record.
 */
export function UnloggedDayActions({ student, date }: { student: Student; date: string }) {
  const { db, saveEntries, dismissDay, undismissDay } = useStore();
  const hours = heldHours(student, date, ledgerOf(db));
  const when = `${student.name.split(" ")[0]} · ${formatDate(date)}`;

  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button
        size="xs"
        variant="ghost"
        className={QUIET}
        onClick={() => {
          saveEntries([student.id], date, { hours });
          toast.success(`${formatHours(hours)} hours saved`, { description: when });
        }}
      >
        Held {formatHours(hours)}h
      </Button>
      {ABSENCE_CODES.map((code) => (
        <Tooltip key={code}>
          <TooltipTrigger
            render={
              <Button
                size="xs"
                variant="ghost"
                className={QUIET}
                aria-label={`${ABSENCE_LABEL[code]} on ${formatDate(date)}`}
                onClick={() => {
                  saveEntries([student.id], date, { code });
                  toast.success(`${ABSENCE_LABEL[code]} recorded`, { description: when });
                }}
              >
                {code}
              </Button>
            }
          />
          <TooltipContent>{ABSENCE_LABEL[code]}</TooltipContent>
        </Tooltip>
      ))}
      <Button
        size="xs"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => {
          dismissDay(student.id, date);
          toast("Nothing to record", {
            description: when,
            action: { label: "Undo", onClick: () => undismissDay(student.id, date) },
          });
        }}
      >
        Dismiss
      </Button>
    </span>
  );
}
