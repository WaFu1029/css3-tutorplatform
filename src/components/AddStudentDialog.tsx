"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { useStore } from "@/lib/store";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddStudentDialog() {
  const { db, addStudent, identity } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tutorId, setTutorId] = useState(
    identity.role === "tutor" ? identity.tutorId : (db.tutors[0]?.id ?? ""),
  );
  const [site, setSite] = useState("Bloomfield Public Library");
  const [days, setDays] = useState("");
  const [times, setTimes] = useState("");

  function submit() {
    if (!name.trim() || !tutorId) return;
    addStudent({ name: name.trim(), tutorId, site, days, times });
    toast.success(`${name.trim()} added`, {
      description: `Assigned to ${db.tutors.find((t) => t.id === tutorId)?.name}`,
    });
    setName("");
    setDays("");
    setTimes("");
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
          <Field orientation="responsive">
            <Field>
              <FieldLabel htmlFor="new-days">Days</FieldLabel>
              <Input
                id="new-days"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="Tue & Thu"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-times">Times</FieldLabel>
              <Input
                id="new-times"
                value={times}
                onChange={(e) => setTimes(e.target.value)}
                placeholder="6:00–7:30 pm"
              />
            </Field>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={!name.trim()}>
            Save student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
