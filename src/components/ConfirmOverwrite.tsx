"use client";

import { useState } from "react";
import type { SessionEntry } from "@/lib/types";
import type { EntryValue } from "@/lib/store";
import { ABSENCE_LABEL } from "@/lib/absence";
import { formatDate, formatHours } from "@/lib/fy";
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

/** What a day holds or would hold, in words: "Held · 2 h", "Tutor absent". */
export function describeEntry(value: EntryValue | SessionEntry): string {
  if ("code" in value && value.code) return ABSENCE_LABEL[value.code];
  return `Held · ${formatHours(value.hours ?? 0)} h`;
}

function sameValue(entry: SessionEntry, next: EntryValue): boolean {
  return "code" in next ? entry.code === next.code : !entry.code && entry.hours === next.hours;
}

type Pending = {
  who: string;
  date: string;
  before: SessionEntry;
  /** null when the day is being cleared. */
  after: EntryValue | null;
  run: () => void;
};

/**
 * Asks before a day that already has an entry is changed or cleared. Writing
 * to an empty day, or re-saving the same value, goes straight through.
 *
 * `guard(existing, next, run)` runs `run` now or after the tutor confirms;
 * render `dialog` once in the component that calls it.
 */
export function useConfirmOverwrite(who: string) {
  const [pending, setPending] = useState<Pending | null>(null);

  function guard(
    date: string,
    existing: SessionEntry | undefined,
    next: EntryValue | null,
    run: () => void,
  ) {
    if (!existing || (next && sameValue(existing, next))) return run();
    setPending({ who, date, before: existing, after: next, run });
  }

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open: boolean) => !open && setPending(null)}>
      <AlertDialogContent>
        {pending && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pending.after ? "Replace this log?" : "Clear this log?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pending.who} on {formatDate(pending.date)} is logged as{" "}
                <span className="font-medium text-foreground">{describeEntry(pending.before)}</span>
                {pending.after ? (
                  <>
                    . Change it to{" "}
                    <span className="font-medium text-foreground">
                      {describeEntry(pending.after)}
                    </span>
                    ?
                  </>
                ) : (
                  ". Clearing leaves the day unlogged."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                autoFocus
                variant={pending.after ? "default" : "destructive"}
                onClick={() => {
                  pending.run();
                  setPending(null);
                }}
              >
                {pending.after ? "Replace" : "Clear"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guard, dialog };
}
