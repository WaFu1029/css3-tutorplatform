"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { slotHours, WEEKDAY_SHORT } from "@/lib/schedule";
import { MAX_SESSION_HOURS } from "@/lib/fy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function AddStudentDialog() {
  const { db, addStudent, identity } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tutorId, setTutorId] = useState(
    identity.role === "tutor" ? identity.tutorId : (db.tutors[0]?.id ?? ""),
  );
  const [site, setSite] = useState("Bloomfield Public Library");
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:30");

  const length = slotHours({ weekday: 0, startTime, endTime });
  const timeError =
    weekdays.length === 0
      ? null
      : length <= 0
        ? "The session has to end after it starts."
        : length > MAX_SESSION_HOURS
          ? `A session tops out at ${MAX_SESSION_HOURS} hours.`
          : null;

  function submit() {
    if (!name.trim() || !tutorId || timeError) return;
    const schedule = weekdays
      .map(Number)
      .sort((a, b) => a - b)
      .map((weekday) => ({ weekday, startTime, endTime }));
    addStudent({ name: name.trim(), tutorId, site, schedule });
    toast.success(`${name.trim()} added`, {
      description: `Assigned to ${db.tutors.find((t) => t.id === tutorId)?.name}`,
    });
    setName("");
    setWeekdays([]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <PlusIcon /> Add a student
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a student</DialogTitle>
          <DialogDescription>
            The student gets a sheet for this fiscal year as soon as you save.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="new-name">Student name</FieldLabel>
            <Input
              className="bg-input-surface"
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-tutor">Tutor</FieldLabel>
            <Select
              items={Object.fromEntries(db.tutors.map((t) => [t.id, t.name]))}
              value={tutorId}
              onValueChange={(value: string | null) => value && setTutorId(value)}
            >
              <SelectTrigger id="new-tutor" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db.tutors.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="new-site">Tutoring site</FieldLabel>
            <Input
              id="new-site"
              className="bg-input-surface"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Days</FieldLabel>
            <ToggleGroup
              multiple
              value={weekdays}
              onValueChange={(v: string[]) => setWeekdays(v)}
              className="flex-wrap"
              aria-label="Days tutored"
            >
              {WEEKDAY_SHORT.map((day, i) => (
                <ToggleGroupItem
                  key={day}
                  value={String(i)}
                  className="h-8 w-11 border-transparent bg-muted hover:bg-muted-hover data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground data-[pressed]:hover:bg-secondary"
                >
                  {day}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field orientation="responsive">
            <Field>
              <FieldLabel htmlFor="new-start">From</FieldLabel>
              <Input
                id="new-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-input-surface"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-end">To</FieldLabel>
              <Input
                id="new-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                aria-invalid={timeError ? true : undefined}
                className="bg-input-surface"
              />
            </Field>
          </Field>
          {timeError ? <FieldError>{timeError}</FieldError> : null}
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={!name.trim() || Boolean(timeError)}>
            Save student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
