"use client";

import { useState } from "react";
import { cn } from "cn";
import { countWords, NOTE_MAX_WORDS } from "@/lib/mutations";

/**
 * A short free-text note on a session, capped at NOTE_MAX_WORDS words: typing
 * past the cap is refused rather than cut off later. Controlled, so the same
 * field serves the day card (saving to the entry) and the log card (saving
 * with the session).
 */
export function NoteField({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  hint,
  maxWords = NOTE_MAX_WORDS,
  placeholder = "What you worked on, anything the office should know…",
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Shown in place of the word count, e.g. why the field is disabled. */
  hint?: string;
  maxWords?: number;
  placeholder?: string;
  rows?: number;
}) {
  const words = countWords(value);

  return (
    <section aria-label="Notes" className="space-y-2 border-t pt-4">
      <label htmlFor={id} className="text-sm font-medium">
        Notes
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={disabled ? undefined : placeholder}
        onChange={(e) => {
          if (countWords(e.target.value) <= maxWords) onChange(e.target.value);
        }}
        onBlur={onBlur}
        className="w-full resize-y rounded-lg border border-input bg-input-surface px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <p
        className={cn(
          "text-xs text-muted-foreground tabular-nums",
          !hint && words >= maxWords && "text-foreground",
        )}
      >
        {hint ?? `${words}/${maxWords} words`}
      </p>
    </section>
  );
}

/**
 * The note on a logged day, saved to that day's entry as it's typed. Saving
 * on blur isn't safe here: clicking off the calendar unmounts the card
 * before the field's blur would run. A day with nothing logged has no entry
 * to hold a note yet.
 */
export function SessionNote({
  note,
  logged,
  fieldId,
  onSave,
}: {
  note: string;
  logged: boolean;
  fieldId: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  const [edited, setEdited] = useState(false);
  const words = countWords(draft);

  return (
    <NoteField
      id={fieldId}
      value={logged ? draft : ""}
      onChange={(next) => {
        setDraft(next);
        setEdited(true);
        onSave(next);
      }}
      disabled={!logged}
      hint={
        !logged
          ? "Log the day to add a note."
          : edited
            ? `${words}/${NOTE_MAX_WORDS} words · saved`
            : undefined
      }
    />
  );
}
