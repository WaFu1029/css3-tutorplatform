"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Student } from "@/lib/types";
import { formatDate, todayISO } from "@/lib/fy";
import { useStore } from "@/lib/store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function StudentDetails({ student }: { student: Student }) {
  const { updateStudent, setStopped } = useStore();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Where and when</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`site-${student.id}`}>Tutoring site</FieldLabel>
            <Input
              id={`site-${student.id}`}
              value={student.site}
              onChange={(e) => updateStudent(student.id, { site: e.target.value })}
              className="bg-input-surface"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`days-${student.id}`}>Days</FieldLabel>
            <Input
              id={`days-${student.id}`}
              value={student.days}
              onChange={(e) => updateStudent(student.id, { days: e.target.value })}
              className="bg-input-surface"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`times-${student.id}`}>Times</FieldLabel>
            <Input
              id={`times-${student.id}`}
              value={student.times}
              onChange={(e) => updateStudent(student.id, { times: e.target.value })}
              className="bg-input-surface"
            />
          </Field>
        </div>

        {student.stopped ? (
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden className="size-2 rounded-full bg-destructive" />
              Stopped {formatDate(student.stopped.on)}
            </p>
            <p className="text-sm text-muted-foreground">{student.stopped.reason}</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => setStopped(student.id, null)}
            >
              Tutoring resumed
            </Button>
          </div>
        ) : (
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground hover:text-foreground">
                  This student stopped being tutored
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop tutoring {student.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  The office is notified and the sheet closes on today&apos;s date. You can
                  reopen it if tutoring starts again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Field>
                <FieldLabel htmlFor={`reason-${student.id}`}>Reason</FieldLabel>
                <Input
                  id={`reason-${student.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Moved, schedule conflict, goals met…"
                  className="bg-input-surface"
                />
              </Field>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep tutoring</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setStopped(student.id, {
                      on: todayISO(),
                      reason: reason.trim() || "No reason given.",
                    });
                    setReason("");
                    setOpen(false);
                    toast.info(`${student.name} marked as stopped`, {
                      description: "The office sees this on the monthly report.",
                    });
                  }}
                >
                  Mark stopped
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
