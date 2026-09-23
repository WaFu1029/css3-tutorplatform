"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InfoIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import type { Group, SharedGoal, Student } from "@/lib/types";
import { GOAL_SECTIONS, catalogGoal, goalLabel } from "@/lib/goals";
import { GROUP_NOTE_MAX_WORDS } from "@/lib/mutations";
import { NoteField } from "@/app/_components/SessionNote";
import { currentSlots, formatSchedule } from "@/lib/schedule";
import { activeGroups, currentMemberIds } from "@/lib/logic";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScheduleFields, useScheduleFields } from "@/components/ScheduleFields";

const CHIP =
  "h-8 px-3 border-transparent bg-muted hover:bg-muted-hover data-[pressed]:bg-secondary data-[pressed]:text-secondary-foreground data-[pressed]:hover:bg-secondary";

/**
 * The tutor's groups: create, rename, change members and schedule, delete.
 * Every change takes effect today, so past days keep the group as it was.
 */
export function GroupsPanel({
  tutorId,
  students,
  className,
}: {
  tutorId: string;
  students: Student[];
  className?: string;
}) {
  const { db } = useStore();
  const groups = activeGroups(db.groups).filter((g) => g.tutorId === tutorId);
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);
  const name = (id: string) => db.students.find((s) => s.id === id)?.name.split(" ")[0] ?? "—";

  return (
    <section aria-label="Groups" className={cn("space-y-2", className)}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          Groups
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="What groups are for"
                  className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <InfoIcon className="size-3.5" />
                </button>
              }
            />
            <TooltipContent className="max-w-xs text-left leading-snug">
              For students you tutor together. A group&apos;s meetings show on each member&apos;s
              calendar, one tap logs the whole session for everyone, and shared goals are added to
              every member&apos;s goals. Each student still gets their own hours, notes and progress on
              their sheet.
            </TooltipContent>
          </Tooltip>
        </h2>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <PlusIcon /> New group
        </Button>
      </div>
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Tutor several students together? Make a group to log them in one go.
        </p>
      )}
      <ul className="space-y-1.5">
        {groups.map((g) => (
          <li key={g.id} className="flex items-start gap-1 rounded-md border bg-card py-1 pr-2 pl-1 hover:bg-card-hover">
            {/* The whole row opens the group's details for editing. */}
            <button
              type="button"
              onClick={() => setEditing(g)}
              aria-label={`${g.name}: edit details`}
              className="flex min-w-0 flex-1 items-start gap-3 rounded-sm px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{g.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {currentMemberIds(g).map(name).join(", ") || "No members"} ·{" "}
                  {formatSchedule(currentSlots(g.schedule))}
                </span>
              </span>
            </button>
            <Button variant="ghost" size="icon-xs" aria-label={`Edit ${g.name}`} onClick={() => setEditing(g)}>
              <PencilIcon />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label={`Delete ${g.name}`} onClick={() => setDeleting(g)}>
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>

      {editing && (
        <GroupDialog
          key={editing === "new" ? "new" : editing.id}
          group={editing === "new" ? null : editing}
          tutorId={tutorId}
          students={students}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteGroup group={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}

function GroupDialog({
  group,
  tutorId,
  students,
  onClose,
}: {
  group: Group | null;
  tutorId: string;
  students: Student[];
  onClose: () => void;
}) {
  const { addGroup, updateGroup } = useStore();
  const [name, setName] = useState(group?.name ?? "");
  const [members, setMembers] = useState<string[]>(group ? currentMemberIds(group) : []);
  const schedule = useScheduleFields(group ? currentSlots(group.schedule) : []);
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>(group?.sharedGoals ?? []);
  const [note, setNote] = useState(group?.note ?? "");
  const valid = name.trim() && members.length > 0 && !schedule.error;

  function save() {
    if (!valid) return;
    const fields = {
      name: name.trim(),
      memberIds: members,
      slots: schedule.schedule,
      sharedGoals,
      note,
    };
    if (group) updateGroup(group.id, fields);
    else addGroup({ tutorId, ...fields });
    toast.success(group ? `${fields.name} updated` : `${fields.name} created`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{group ? `Edit ${group.name}` : "New group"}</DialogTitle>
            <DialogDescription>
              Log the whole group at once. Each member still gets their own entry and keeps their own goals.
              Changes apply from today; earlier days keep the group as it was.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="group-name">Name</FieldLabel>
                <Input
                  id="group-name"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wednesday conversation circle"
                  className="bg-input-surface"
                />
              </Field>
              <Field>
                <FieldLabel>Members</FieldLabel>
                <ToggleGroup
                  multiple
                  value={members}
                  onValueChange={(v: string[]) => setMembers(v)}
                  className="flex-wrap"
                  aria-label="Members"
                >
                  {students.map((s) => (
                    <ToggleGroupItem key={s.id} value={s.id} className={CHIP}>
                      {s.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {members.length === 0 && <FieldDescription>Pick at least one student.</FieldDescription>}
              </Field>
              <ScheduleFields
                idPrefix="group"
                fields={schedule}
                emptyHint="Leave empty if the group meets when it can. Its days then aren't expected."
              />
            </FieldGroup>

            <div className="space-y-5 md:border-l md:pl-6">
              <SharedGoalsField value={sharedGoals} onChange={setSharedGoals} />
              <NoteField
                id="group-note"
                value={note}
                onChange={setNote}
                maxWords={GROUP_NOTE_MAX_WORDS}
                rows={7}
                placeholder="What the group works on, how it runs, anything the office should know…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              {group ? "Save group" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The goals the whole group works toward. Saving copies each onto every
 * current member's goal board (and a new member's, when they join); taking
 * one off here leaves the copies members already have.
 */
function SharedGoalsField({
  value,
  onChange,
}: {
  value: SharedGoal[];
  onChange: (next: SharedGoal[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const chosen = new Set(value.flatMap((g) => ("catalogKey" in g ? [g.catalogKey] : [])));
  const label = (g: SharedGoal) => ("catalogKey" in g ? goalLabel(g.catalogKey) : g.customLabel);

  function addCustom() {
    const text = custom.trim();
    if (!text) return;
    if (!value.some((g) => "customLabel" in g && g.customLabel.toLowerCase() === text.toLowerCase())) {
      onChange([...value, { customLabel: text }]);
    }
    setCustom("");
  }

  return (
    <section aria-label="Shared goals" className="space-y-2">
      <p className="text-sm font-medium">Shared goals</p>
      <p className="text-xs text-muted-foreground">
        Added to each member&apos;s goals when you save. Progress is still tracked per student.
      </p>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((g) => (
            <li
              key={label(g)}
              className="flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-0.5 pl-2 text-sm text-secondary-foreground"
            >
              {label(g)}
              {"catalogKey" in g && catalogGoal(g.catalogKey)?.federal && (
                <span className="text-primary">*</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove shared goal: ${label(g)}`}
                onClick={() => onChange(value.filter((x) => x !== g))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <select
        aria-label="Add a goal from the form"
        value=""
        onChange={(e) => e.target.value && onChange([...value, { catalogKey: e.target.value }])}
        className="h-8 w-full rounded-lg border border-input bg-input-surface px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Add a goal from the form…</option>
        {GOAL_SECTIONS.map((section) => (
          <optgroup key={section.key} label={section.title}>
            {section.goals
              .filter((g) => !chosen.has(g.code))
              .map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                  {g.federal ? " *" : ""}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <div className="flex gap-1.5">
        <Input
          aria-label="Add a goal in your own words"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Or in your own words"
          className="h-8 bg-input-surface"
        />
        <Button type="button" variant="outline" size="sm" disabled={!custom.trim()} onClick={addCustom}>
          Add
        </Button>
      </div>
    </section>
  );
}

function DeleteGroup({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const { removeGroup } = useStore();
  return (
    <AlertDialog open={Boolean(group)} onOpenChange={(open: boolean) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {group?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Sessions already logged for the group stay on each student&apos;s sheet, and its
            past meetings still count as scheduled. From today it&apos;s gone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (group) {
                removeGroup(group.id);
                toast.info(`${group.name} deleted`, { description: "Logged sessions are unchanged." });
              }
              onClose();
            }}
          >
            Delete group
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
