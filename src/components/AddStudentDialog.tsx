"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatSchedule } from "@/lib/schedule";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleFields, useScheduleFields } from "@/components/ScheduleFields";
import { SitePicker } from "@/components/SitePicker";
import { DEFAULT_SITE, siteNamed } from "@/lib/sites";

export function AddStudentDialog({ size }: { size?: "sm" | "default" } = {}) {
  const { db, addStudent, identity } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tutorId, setTutorId] = useState(
    identity.role === "tutor" ? identity.tutorId : (db.tutors[0]?.id ?? ""),
  );
  const [site, setSite] = useState(DEFAULT_SITE);
  const schedule = useScheduleFields();
  const timeError = schedule.error;

  function submit() {
    if (!name.trim() || !tutorId || timeError) return;
    addStudent({ name: name.trim(), tutorId, site, slots: schedule.schedule });
    toast.success(`${name.trim()} added`, {
      description: `${formatSchedule(schedule.schedule)} · ${db.tutors.find((t) => t.id === tutorId)?.name}`,
    });
    setName("");
    schedule.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size={size}>
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
            <SitePicker id="new-site" value={site} onChange={setSite} className="w-full" />
            <FieldDescription>
              {siteNamed(site)?.address} · open {siteNamed(site)?.hoursLabel}
            </FieldDescription>
          </Field>
          <ScheduleFields
            idPrefix="new"
            fields={schedule}
            emptyHint="Leave the days empty for a walk-in student who comes when they can."
          />
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
