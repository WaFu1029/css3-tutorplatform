# Handoff

Each session adds its own section. Edit only yours.

## Session 3: Monthly reports, roles, route guards, staff view

> **Superseded in part by the Follow-up section at the end of this file**: the schedule no longer gates sending, month statuses are `not-started` / `open` / `sent`, and "gaps" are now "unlogged scheduled days". Where this section disagrees with the Follow-up, the Follow-up is right.

### What landed

| File | What |
| --- | --- |
| `src/app/reports/page.tsx` | Chooses the view by role: staff get `StaffReports`, tutors get `TutorReports`. Holds the month (defaults to the current month). |
| `src/app/reports/_components/TutorReports.tsx` | Tutor view. One row per own student: hours, sessions, missed, unlogged dates, status. Per-row Send / Reopen, "Send all ready" with a list of skipped students and the reason for each, and a year-sheet link. |
| `src/app/reports/_components/StaffReports.tsx` | Staff view, read-only. Filters by tutor, site, and status. Table grouped by tutor. Panels for "not yet sent" by tutor, hours by site plus the overall total, achievements attained that month (starred ones keep the `*`), and a highlighted list of students stopped that month with the reason. Summary CSV, sessions CSV, and Open/Print year-sheet links. |
| `src/app/reports/_components/parts.tsx` | Month picker, filter select, status badge, stat, goal label, sheet links. |
| `src/app/reports/_lib/report.ts` | Builds the rows from `lib/logic`, works out skip reasons, builds the CSVs. |
| `src/lib/permissions.ts` | Added `ROUTE_RULES`, `routePermission`, `studentIdInPath`, `canOpenPath`. |
| `src/components/RouteGuard.tsx` | New. Wraps every page. If the role may not open the path, the page renders nothing and the guard redirects to `landingFor(identity)`. |
| `src/app/layout.tsx` | **Shared file, one edit:** `<main>` now wraps `{children}` in `<RouteGuard>`. |

Route rules (first match wins):

- `/students/:id/sheet` needs `reports:view`. Staff can open it; a tutor can open it only for their own students.
- `/students/:id` needs `log:view`. Staff are redirected to `/reports`. A tutor opening another tutor's student is redirected to `/`.
- `/` needs `log:view`. `/reports` needs `reports:view`.

These guards only shape the UI; they are not a security boundary (see the note in `permissions.ts`). Real enforcement still needs RLS policies in Supabase.

### Stubs

**None remain.** I started with a local copy of `scheduledDates`, `findGaps`, `monthSummary`, and `canSend`. Session 1's `src/lib/logic.ts` landed with matching signatures (`entries` and `today` as trailing arguments), so I deleted the stub and now import from `@/lib/logic`. Sending and reopening use the store's `sendMonth` and `reopenMonth`.

### Needs from other sessions

**Session 2 (student page and year sheet):**

1. **Deep link to a month.** Gap links go to `/students/:id?month=YYYY-MM#month-YYYY-MM`. Please open that month from `?month`, or give each month section `id="month-YYYY-MM"`. The URL is built in one place, `studentMonthHref()` in `src/app/reports/_lib/report.ts`, if you want a different shape.
2. **Print link.** Staff "Print" opens `/students/:id/sheet?print=1` in a new tab. Please call `window.print()` once the sheet has rendered when `print=1` is set. Until then it opens the sheet without printing.
3. **Back link on the sheet.** It goes to `/`, so staff are redirected to `/reports`. That works, but a back link chosen by role (or `router.back()`) would read better.
4. **Your local stubs.** `src/app/students/[id]/_lib/shared-stubs.ts` is still there, and `lib/logic.ts` now covers it.

**Session 1 (data layer):**

1. **Status wording.** This tab uses the task's words: *open* means there are gaps, *ready* means no gaps, *sent* is sent, and *not started* is a future month. The `MonthStatus` type in `lib/logic` uses *gaps / open / ready / sent*, where *open* means no gaps but sessions still ahead. The same word means different things on the two pages. Please agree on one set of words. Mine is `STATUS_LABEL` in `report.ts`.
2. **Sending a month before it ends.** `canSend` allows sending the current month partway through, since there are no gaps up to today. After that, `saveEntries` locks the month, so the tutor has to reopen it to log the rest. Confirm this is intended.
3. **Seed data for the staff view.** The seed was cut to one tutor. To show the staff view properly (several tutors and sites, a stop with a reason this month, a student with gaps), the seed needs at least two tutors, a stopped student, and one missing scheduled day.

### Checked

- ESLint and `tsc` pass on every file I touched. At the time of writing, the remaining `tsc` errors were in session 1/2 files that were mid-migration.
- I tested the row logic against contract-shaped data. Gaps are dates up to today, reopened reports count as unsent, students stopped before the month are left out, starred goals are marked, and CSV rows are correct.
- Before the store migration, I checked both views in headless Chrome. Staff were redirected from `/` and `/students/:id` to `/reports`, and could open `/students/:id/sheet`.
- **I have not re-run the views in a browser against the new store.** It was not compiling when I finished.

## Session 1: Data layer, shared logic, shared components, home page

> **Superseded in part by the Follow-up section at the end of this file**: the schedule no longer gates sending, month statuses are `not-started` / `open` / `sent`, and "gaps" are now "unlogged scheduled days". Where this section disagrees with the Follow-up, the Follow-up is right.

### What landed

| File | What |
| --- | --- |
| `src/lib/types.ts` | The contract: `Student` (with `schedule`, `status`, `stoppedReason?`, `stoppedDate?`), `SessionEntry` (exactly one of `hours` or `code`, plus `groupId?`), `Goal` (`catalogKey` or `customLabel`, `category`, `addedDate`, `attainedDate?`), `MonthReport` (`open`/`sent`, `sentAt?`), and `DB` = `{ tutors, students, entries, goals, reports }`. `Entry` is kept as a deprecated alias of `SessionEntry`. |
| `src/lib/logic.ts` | Shared logic: `scheduledDates`, `findGaps`, `monthSummary`, `canSend`, plus `slotOn`, `scheduledHours`, `monthStatus`, `expectsReport`, `reportFor`, `isMonthSent`, `entryOn`, `entryIndex`, `hoursInMonth`, `sessionsInMonth`, `lastSession`, `makeEntry`. All pure. |
| `src/lib/logic.test.ts`, `src/lib/migrate.test.ts` | Vitest, 30 tests. Run with `npm test`. |
| `src/lib/schedule.ts` | `slotHours`, `formatTime`, `formatSlotTime`, `formatSchedule`, `WEEKDAY_SHORT`. |
| `src/lib/goals.ts` | Catalog from the paper form. Each section now has `category`, and `federal: true` is the star. New helpers: `goalText(goal)`, `isStarred(goal)`, `categoryOf(code)`, `CATEGORY_TITLE`. The catalog type was renamed from `Goal` to `CatalogGoal`, because `Goal` is now the contract type. |
| `src/lib/absence.ts` | Codes are `TA` / `SA` / `H`, as on the form. `ABSENCE_KEYS` still maps the t / s / h keys. |
| `src/lib/migrate.ts` | Converts old caches (`lvaep.tutorlog.v1` / `v2`) to the new shape: free-text days and times become `schedule`, T/S become TA/SA, submissions become sent reports, and attained goals become `Goal` records. |
| `src/lib/store.tsx` | Cache key `lvaep.tutorlog.v3`. Actions are listed below. |
| `src/lib/seed.ts` | Maria only (the user's call earlier today), with schedules, goals in progress, and one deliberate gap (Rosa's last Mon/Wed). Today's sessions are left unlogged so the Today card has something to show. |
| `src/components/LoggingBar.tsx` | Shared. See props below. |
| `src/components/GoalsColumn.tsx` | Shared. `<GoalsColumn students={Student[]} />` |
| `src/components/StudentSidebar.tsx` | Shared. `<StudentSidebar students activeId? showStatus? title? />`. Rows link to `/students/:id`. Also exports `StatusBadge`. |
| `src/app/page.tsx`, `src/app/_components/TodayCard.tsx` | Home (Tutoring log). |
| `src/components/AddStudentDialog.tsx` | Now collects the schedule as weekday chips plus start and end times, instead of free text. Only the home page uses it. |
| `src/components/QuickLog.tsx`, `GoalsPanel.tsx`, `StudentRail.tsx` | **Deprecated wrappers** over LoggingBar, GoalsColumn and StudentSidebar. They exist only so `src/app/students/[id]/page.tsx` keeps working. Delete them once that page imports the new components. |
| `src/components/MonthClose.tsx`, `StudentDetails.tsx` | **Deleted.** Nothing imported them any more, and they were the last files failing `tsc`. |
| `package.json`, `vitest.config.ts` | Adds `vitest` (dev) and `npm test`. |

### Shared logic signatures

Every function that depends on "today" takes it as an optional trailing argument, which keeps them testable.

```ts
scheduledDates(student, month): string[]
findGaps(student, month, entries, today?): string[]
monthSummary(student, month, entries, today?): { hours, sessions, missed, gaps: string[] }
canSend(student, month, entries, today?): boolean
monthStatus(student, month, { entries, reports }, today?): "sent" | "gaps" | "ready" | "open"
```

- **Today is not a gap.** `findGaps` counts scheduled dates *before* today. Today's session may simply not have happened yet. This matches session 2's stub.
- `scheduledDates` respects `startedOn` (an optional extra field on `Student`, not in the contract) and `stoppedDate`, inclusive.
- `monthSummary.gaps` is the list of dates. Use `.length` for a count.
- `missed` counts TA + SA. Holidays count toward neither sessions nor missed.

### Store actions

| Action | Notes |
| --- | --- |
| `saveEntries(studentIds, date, { hours } \| { code })` | Returns `{ saved, locked }`. Replaces an existing entry on that date and keeps its `id`. Several students share one new `groupId`. Re-saving a single student keeps their old `groupId`. Students whose month is sent are skipped and returned in `locked`. |
| `clearEntry` | |
| `addGoal(studentId, { catalogKey } \| { customLabel })` | |
| `setGoalAttained(goalId, bool)` | Stamps today's date, or clears it. |
| `removeGoal` | |
| `addStudent({ name, tutorId, site, schedule })` | |
| `updateStudent` | |
| `stopStudent(id, reason, date?)` | |
| `resumeStudent` | |
| `sendMonth` | Refuses (returns `false`) while there are gaps. |
| `reopenMonth` | `submitMonth` and `unsubmitMonth` remain as deprecated aliases. |

### LoggingBar props

- `students` (the candidates)
- `preselectedStudentId?` (for the student page)
- `selectedIds?` and `onSelectedIdsChange?` (controlled; the home page uses this so the goals column follows the selection)

Behaviour:

- **Smart default.** If every selected student already has the same entry on the date, the bar opens on that entry. Otherwise, if the selected students are scheduled with the same slot length, it opens on that length.
- **Existing entries** are edited in place, and the bar says so.
- **Sent months** block saving and offer "Reopen <Month>".

### Stubs

**None.** I needed nothing from sessions 2 or 3 that didn't already exist. StudentSidebar links to `/students/:id`, which session 2 has built.

### Answers to session 3

1. **Status wording.** The home spec asks for four states: *open / ready / sent / has gaps*. `MonthStatus` follows that, with *open* meaning no gaps yet but sessions still ahead. In your tab, *open* means gaps, which clashes with the home list. Suggestion: build your row status from `monthStatus()`, and add your *upcoming* state for future months. Then label `gaps` as "Has gaps" and `open` as "Open". That way both pages use one vocabulary.
2. **Sending a month partway through.** This is intended: the contract says `canSend` is true exactly when there are no gaps. The home page only shows **Ready to send** once there are no scheduled days left, today included. A tutor who sends early has to reopen the month to log the rest, and the LoggingBar offers that reopen in place.
3. **Seed.** The user asked to keep only Maria, so I haven't added tutors back. Rosa does have a gap. Whether to add a stopped student or more tutors for the staff demo is the user's call.
4. **Gaps "up to today".** As of this session, gaps are dates **before** today (see above). Please re-check any tests that assumed today counts.

### Checked

- `npx tsc --noEmit` is clean across the whole tree, including sessions 2 and 3's current files.
- `npm test`: 36 passing (30 of them mine).
- `npm run build` succeeds.
- `npm run lint`: 1 error remains, `react-hooks/set-state-in-effect` on the store's cache load. It existed before this work (there were 2 before).
- The home page renders correctly in headless Chrome against a production build. I did **not** click through the interactions in a browser, only checked render and logic.

## Session 2: Student page and printable year sheet

> **Superseded in part by the Follow-up section at the end of this file**: the schedule no longer gates sending, month statuses are `not-started` / `open` / `sent`, and "gaps" are now "unlogged scheduled days". Where this section disagrees with the Follow-up, the Follow-up is right.

### What landed

| File | What |
| --- | --- |
| `src/app/students/[id]/page.tsx` | Student page. `StudentSidebar` on the left. On the right: header, then `GoalsColumn` (about 1/4 width) beside the attendance area. The attendance area has the fiscal-year strip, the calendar, and the month summary. Reads `?month=YYYY-MM` and follows it when it changes. The attendance section has `id="month-YYYY-MM"`. |
| `_components/StudentHeader.tsx` | Name, Active/Stopped badge, and inline-editable site and schedule. The schedule editor has one row per weekday with start and end times and writes `ScheduleSlot[]`. "Stopped being tutored…" opens a dialog that requires a reason and a last-day date (defaults to today, must fall between `startedOn` and today) and calls `stopStudent`. When stopped, a banner shows the date and reason with a Reactivate button (`resumeStudent`). |
| `_components/MonthCalendar.tsx` | Month grid with prev/next buttons, limited to the fiscal year. Click a day, then type hours and press Enter, or press T/S/H, or Backspace to clear. Arrow keys move between days and across months. Below the grid is a bar for the selected day with hour presets, an "other" field, TA/SA/H, and Clear. Scheduled days get a dot. Gaps are filled red and marked "not logged". Future days and sent months are read-only and show a message explaining why. |
| `_components/MonthSummary.tsx` | Hours, sessions, and missed for the month. "Send [Month] to the office" is disabled while there are gaps or the month hasn't started. Each gap gets quick buttons: Held (its scheduled length), SA, TA, H. A sent month shows the sent date and a Reopen button. |
| `_components/FiscalYearStrip.tsx` | Jul–Jun. Each month shows as not started (—), open (hours, with a red dot if it has gaps), or sent (ink). Clicking a month moves the calendar there. |
| `_lib/helpers.ts` (+ test) | `heldHours`, `formatDays`, `formatTimes`, `isStopped`, `outsideEnrolment`. |
| `src/app/students/[id]/sheet/page.tsx` | Year sheet laid out like the paper form, letter landscape, one page. The header has tutor, student, site, day(s), and time(s). The 31 × 12 grid shows hours or TA/SA/H, with a totals row and the year-to-date total. The full catalog is listed with `*` markers and attained goals ticked (with dates). Custom goals appear under "E. Other(s)". Also has the Stopped checkbox with the date and reason, and the form's footer line. `?print=1` opens the print dialog after the page renders. The back link depends on role: tutors go to the student page, staff go to `/reports`. |

Guarding: the page relies on session 3's `RouteGuard`. It also shows its own "not on your list" state when the student isn't among `visibleStudents`.

### Stubs

**None.** The shared logic comes from `@/lib/logic` (`scheduledDates`, `monthSummary`/`findGaps`, `reportFor`, `isMonthSent`, `entryIndex`), `@/lib/schedule`, and the store (`saveEntries`, `clearEntry`, `updateStudent`, `stopStudent`, `resumeStudent`, `sendMonth`, `reopenMonth`). The calendar takes its gaps from `monthSummary().gaps` instead of recomputing them, so it follows whatever rule `findGaps` uses (currently `date < today`).

### Replies to session 3

1. Deep link: done. Both `?month=` and `#month-YYYY-MM` work.
2. `?print=1`: done.
3. The sheet's back link now depends on role.
4. The stub file is gone. What's left in `_lib/helpers.ts` isn't in `lib/`.

### For session 1

- **Candidates for `lib/`:** `formatDays` and `formatTimes` (the paper form's Day(s)/Time(s) blanks) and `outsideEnrolment` (the same check as the private `enrolledOn` in `logic.ts`). Export `enrolledOn` and I'll drop mine.
- **Old components no longer used by my page:** `QuickLog`, `GoalsPanel`, `StudentRail`, `Ledger`, `MonthClose`, `StudentDetails`. Delete them if the home page doesn't use them either.
- **"Open" means different things.** My strip and summary badge use *open* to mean "not sent" (the task's wording). See session 3's note on `MonthStatus`.

### Checked

- `tsc` passes on the whole project and `eslint` passes on `src/app/students`. `vitest` passes for `helpers.test.ts` (6 tests).
- I ran the page against the new store in headless Chrome over CDP, using a throwaway profile:
  - T, S, and H set Tutor absent, Student absent, and Holiday. Backspace clears. Typing `1.5` then Enter saves 1.5 h. Typing `9` is rejected with a message. Arrow keys move focus.
  - Typing on a future day is refused. Typing in a sent month is refused with a prompt to reopen it.
  - Rosa's gap disables Send. "Held" resolves the gap and enables Send. Send makes the month sent and the calendar read-only. Reopen unlocks it.
  - The stop dialog blocks "Mark stopped" until a reason is entered. Stopping shows the banner. Reactivate returns the student to Active.
  - `?month=2026-08` opens August.
- The sheet printed to PDF as **1 page, 792×612 (letter landscape)**. The `@page` rule is in an inline `<style>`, so React removes it when you leave the sheet. That keeps it from affecting other prints, and it overrides the portrait `@page` in `globals.css`.
- **Not checked:** printing from Safari or Firefox, and phone-width layout.

## Session 3: edit made outside my files

- `src/app/students/[id]/_components/StudentHeader.tsx`: the user asked for the "Stopped being tutored…" button to be red, so it changed from a muted `ghost` button to `variant="destructive"` (solid red). That is the only change in the file.

## Follow-up: schedule as scaffolding, one set of statuses, walk-ins, groups

This spans all three sessions' files. The ownership split no longer applies.

### 1. The schedule suggests; the tutor decides

- **Sending never blocks.** `canSend` is gone. `store.sendMonth` always sends. The send buttons on the student page and on Monthly reports go through `SendMonthButton` / `SendAllButton` (`src/components/SendReview.tsx`).
- **Send review.** A single send skips the dialog when there's nothing to ask (`sendCheck(...).clean`). Otherwise it opens `SendReviewDialog`, which lists:
  - each unlogged scheduled day, with quick buttons (Held with the scheduled hours, TA, SA, H, Dismiss);
  - "[Month] isn't over yet. Send anyway?", when the month isn't over;
  - "Is everything for [Month] logged?", for a walk-in;
  - "No sessions logged for [Month]. Send anyway?", when there are no sessions.

  The dialog updates live as days are answered. **Send anyway** always works.
- **Send all.** "Send all ready" is now **Send all** on the tutor's Monthly reports. It always opens one combined review across every open sheet.
- **Copy.** The UI says "unlogged scheduled days", or just "unlogged". The code now uses `unloggedDays` and `MonthSummary.unlogged`, which replace `findGaps` and `.gaps`.
- **Dismissals.** A new `DB.dismissals: { studentId, date }[]` records "nothing to record for this day".
  - Store: `dismissDay` / `undismissDay`.
  - Where the tutor can dismiss: the review dialog, the student page's unlogged list, the calendar's day editor ("Nothing to record", with Undo), and the Today card.
  - Dismissed days drop out of `unloggedDays`, and so out of every count, prompt, badge and review.
  - Logging the day later clears the dismissal.
  - The printed sheet only ever shows entries, so dismissals never appear there.
- **Calendar.** Unlogged days get a dashed outline and a muted "unlogged" label, instead of red "not logged". The year strip's dot is a hollow ring rather than red.
- **Today card.** Under today's sessions, an **Earlier this week** section lists unlogged scheduled days from the last 6 days ("Mon, Sep 21 with Rosa Beltrán"), each with the one-tap buttons plus Dismiss, until handled. A day owed through a group appears as one group item for the members still unlogged.

### 2. One set of month statuses

- `monthStatus(student, month, reports, today?)` returns `"not-started" | "open" | "sent"`. Labels are in `MONTH_STATUS_LABEL`.
  - *Not started*: a future month, or one before the student's start.
  - *Open*: anything else not sent.
- `<MonthStatusBadge status unlogged? />` (`src/components/MonthStatusBadge.tsx`) shows the status, with a soft dashed "n unlogged" count beside it. It is used on:
  - the home student list and the student page sidebar
  - the student page's month summary (and the year strip uses the same statuses)
  - both Monthly reports views
- `ReportStatus`, `STATUS_LABEL`, the reports `StatusBadge` and `skipReason` are gone. `ReportRow.gaps` is now `ReportRow.unlogged`.
- The staff status filter is now: Any status / Open / Sent / Not started / With unlogged days.

### 3. Walk-in students

- **Schedule is optional.** `AddStudentDialog` and group editing share `src/components/ScheduleFields.tsx`, and leaving the days empty is fine. The header's schedule editor already allowed no days; its copy now says walk-in.
- **No schedule** means `formatSchedule`, `formatDays` and `formatTimes` return "Walk-in", in the header and on the printed sheet. Walk-ins get no Today card entries and no unlogged days. `isWalkIn(student, groups)` is false when a group gives the student a schedule.
- **Default hours.** When the date isn't scheduled (walk-ins included), LoggingBar and "Held" default to the student's most recent session length (`lastSessionHours`, via `heldHours`), else 1.
- **Unscheduled days.** Logging on any day works as before, for any student.

### 4. Groups

- **Data.** New `Group { id, tutorId, name, studentIds, schedule? }` in `DB.groups`. The cache key is now `lvaep.tutorlog.v4`. A v3 cache loads through `withDefaults`, which adds empty `groups` and `dismissals`. The v1/v2 legacy migration still works.
- **Scheduling.** `scheduledDates(student, month, groups?)` covers the student's own slots plus those of every group they're in. `slotsOn` says which slot (and which group) applies. Everything downstream (unlogged days, scheduled hours, Today) passes `db.groups`.
- **LoggingBar.** Groups appear after the student chips. Picking one opens `GroupSessionForm` (`src/components/GroupSessionForm.tsx`):
  - One row per member, each defaulting to Present with the group's scheduled hours. When it isn't the group's day, each member's last session length is used instead.
  - Each row can switch to Student absent or take other hours.
  - Tutor absent and Holiday apply to the whole group.
  - Save calls `store.saveSession(date, lines)`, which writes one entry per member with a shared `groupId`.
  - Existing entries prefill the rows and are edited in place. Members whose month is sent are skipped, with a Reopen link.
- **Goals column.** Follows the group's members and stacks each member's goals under their name. Goals are never shared.
- **Groups panel.** On the home page, next to the student list (`src/components/GroupsPanel.tsx`): create, rename, edit members and schedule, delete. Deleting asks first and never touches entries.
- **Student header.** Lists the student's groups, with each group's schedule.
- **Today card.** A group meeting today is one item. **Log session** opens the member rows.

### 5. Cleanup

- **Deleted:** `QuickLog`, `GoalsPanel`, `StudentRail`, `Ledger`, `ui/native-select`, `ui/tabs` (nothing imported them), and `src/app/students/[id]/_lib/helpers.ts` with its test.
- **Moved into `lib/`:**
  - `formatDays` and `formatTimes` are now in `lib/schedule.ts`.
  - `enrolledOn` is exported from `lib/logic.ts` and replaces `outsideEnrolment`.
  - `heldHours` is now in `lib/logic.ts`, defaulting to the most recent session length rather than the most frequent.
  - `isStopped` is inlined.
- **Kept on purpose:** `src/lib/utils.ts`, which nothing imports, because `components.json` points shadcn's `utils` alias at it.
- **Pure mutations.** Every DB change is now a pure function in `src/lib/mutations.ts`. The store wraps these and nothing else, which is what makes the send and group rules unit-testable.
- **Store API changes:**
  - Added `saveSession`, `dismissDay`, `undismissDay`, `addGroup`, `updateGroup`, `removeGroup`.
  - `sendMonth` now returns nothing, since it can't fail.
  - Removed the `submitMonth` / `unsubmitMonth` aliases, the `Entry` type alias, and the selector re-exports. Import selectors from `@/lib/logic`.

### Checked

- **`npx tsc --noEmit`:** clean.
- **`npm test`:** 61 passing. New tests cover:
  - sending never blocks, including a month full of unlogged days and one with no sessions
  - dismissals: excluded, idempotent, undo, and cleared by logging
  - all three statuses, and reopening
  - walk-ins: no scheduled or unlogged days, "Held" from the last session, the send review's walk-in flag
  - group `scheduledDates`: adds group slots, ignores other groups and unscheduled groups
  - a group save with one absent member: one entry each, shared `groupId`, the absent member counted as missed, re-saving edits in place and keeps id and group
  - sent months skipped
  - deleting a group keeps its entries
  - v3 → v4 defaults
- **`npm run build`:** succeeds.
- **`npm run lint`:** 1 error, the same `react-hooks/set-state-in-effect` on the store's cache load that was there before this work.
- **Headless Chrome over CDP**, against a production build with a fresh profile. All of these passed:
  1. Logging Citizenship circle from the bar with Luis marked Student absent wrote Amina 1.5 h and Luis SA, sharing one `groupId`.
  2. On Rosa's page, Send opened the review with "September isn't over yet" and her unlogged day. Tapping Held logged the day, and **Send anyway** sent September.
  3. On Monthly reports, **Send all (2)** opened one review ("Send September for 2 students"), and sending marked every September sheet sent.
  4. Adding a walk-in with no days saved `schedule: []`. Their header and the printed sheet say "Walk-in", and they don't appear on the Today card.
  5. With the identity set to staff, `/` and `/students/s-amina` both redirect to `/reports`, and the staff view renders.
- **Not exercised in the browser:** a group item on the Today card. The seeded group meets on Wednesdays, and the run was on a Tuesday. Its pieces (`GroupSessionForm`, group scheduling) were covered through the logging bar and the unit tests.

## Follow-up 2: dated schedules and group membership

Editing a schedule or a group no longer changes what was scheduled in the past.

### Data (`src/lib/types.ts`)

- **`Student.schedule`** is now a history, `ScheduleVersion[]`, where each version is `{ from, slots }`, oldest first. A version applies from its `from` date until the next version starts. Dates before the first version have no schedule. Walk-ins have an empty history, or a version with no slots.
- **`Group`** is now `{ id, tutorId, name, createdOn, deletedOn?, members, schedule }`. Each entry in `members` is `{ studentId, joinedOn, leftOn? }`, and rejoining adds another entry. `schedule` is versioned the same way as a student's. **I made group schedules versioned too, which the brief didn't ask for.** Without that, changing a group's day would still rewrite its past.
- **Deleting a group** sets `deletedOn` and hides it from every list. It does not remove the record. **Removing a member** sets their `leftOn`. Either way, past scheduled days stay put, and so do logged entries.

### Rules (`src/lib/logic.ts`, `src/lib/schedule.ts`)

- A group's slots count for a member on a date only when both of these hold:
  - the date is on or after `createdOn` and on or after that member's `joinedOn`
  - the date is before their `leftOn` and before `deletedOn`

  The helpers are `memberOn`, `groupExistsOn` and `groupSlotOn`.
- `slotsOn`, `scheduledDates` and `scheduledHours` read the version in effect on each date (`versionOn` / `slotsInEffect`).
- For display and editing, use `currentSlots(history)`, `currentMemberIds(group)` and `activeGroups(groups)`. `groupsOf(student, groups)` returns the live groups the student is in now.
- `sendCheck().noSchedule` ("Is everything for [Month] logged?") is now true when nothing was scheduled that month, rather than when the student is a walk-in today.

### Store and mutations

| Action | What it does |
| --- | --- |
| `setStudentSchedule(studentId, slots)` | Writes a new version from today (`withSchedule`). A second edit on the same day replaces that day's version. An edit that changes nothing is ignored. |
| `updateStudent` | Still accepts `schedule`; the other session's header editor uses it with `withSchedule(..., todayISO(), slots)`, which gives the same result. |
| `addGroup({ tutorId, name, memberIds, slots })` | `createdOn` is today and every member joins today, so creating a group never makes a past day unlogged. |
| `updateGroup(id, { name?, memberIds?, slots? })` | New members join today. Removed members get `leftOn` today. A changed schedule takes effect today. |
| `removeGroup(id)` | Sets `deletedOn` to today. |

`addStudent` now takes `slots` and stores them as one version starting today, or an empty history for a walk-in.

### Migration

- The cache key is now **`lvaep.tutorlog.v5`**. A v4 or v3 cache goes through `upgradeV4` (`src/lib/migrate.ts`):
  - Each student's current schedule becomes one version starting at `startedOn`.
  - Each existing group gets `createdOn` and `joinedOn` set to the upgrade day. v4 never recorded those dates, and backdating them would invent unlogged days. Sessions already logged for the group are unchanged.
- v1 and v2 legacy caches migrate straight to the new shape.

### Seed

Citizenship circle now starts 21 days before today. Every meeting since then is logged, with a member occasionally absent, so the group shows real use without a pile of unlogged Wednesdays.

### Checked

- `npx tsc --noEmit` is clean, `npm test` passes (76 tests), and `npm run build` succeeds. These ran against the tree as it stood, including the other session's in-progress files.
- **New tests:**
  - Creating a group today adds no past unlogged days; its first meeting counts once it has passed.
  - Editing a student's schedule leaves past months unchanged, including their unlogged days, and applies from the edit date within the month. A same-day re-edit replaces that version, and a no-op edit is ignored.
  - A member added later only gets the group's dates from their join date. A member taken out keeps their earlier dates and loses the rest.
  - A deleted group keeps its past days and its entries.
  - Renaming a group doesn't touch members or schedule. A group schedule change applies from the edit date only.
  - Nothing is scheduled before a schedule's first version.
  - `upgradeV4`: dates schedules from `startedOn`, starts groups on the upgrade day, and leaves data already in the new shape alone.
- **Headless Chrome:**
  - The seeded group reads `createdOn` 2026-09-01, with no unlogged Wednesdays on the Today card.
  - Logging a group with one member absent, sending a month through the review, and Send all all still pass.

### Another session was editing this tree at the same time

While Follow-up 2 was in progress, another session redesigned the home page, which is now a Dashboard with a students calendar, and added a Students tab. That removed "Add a student" and the Groups panel from the UI. Follow-up 3, below, puts both back.

## Follow-up 3: Students tab, groups UI back, checks

That session has stopped; this one finished its work.

### What changed

- **`/students` (the Students tab)** is now a real page instead of a redirect to the first student. It shows:
  - the tutor's student list (`StudentSidebar` with status; active students first, then stopped)
  - **Add a student** (`AddStudentDialog`)
  - a **Groups** section (`GroupsPanel`)

  With no students, it shows the empty state with Add a student.
- **Groups panel.** It goes through the dated store actions:
  - `addGroup`: the group is created today and its members join today.
  - `updateGroup`: added members join today, removed members get `leftOn` today, and a schedule change takes effect today.
  - `removeGroup`: sets `deletedOn` and hides the group; its entries and past scheduled days are kept.
- **Schedule editor** (student header) now calls `setStudentSchedule`. `updateStudent` again refuses `schedule` in its type, so the dated path is the only way to change a schedule.

### Access

The Students tab is tutor-only, and no change was needed for that. `NAV` gives it `log:view`, which staff don't have, and the route rule `^/students(/|$)` → `log:view` already makes `RouteGuard` redirect staff. The year sheet (`/students/:id/sheet`) is matched first and stays open to staff.

### Checked

- `npx tsc --noEmit` is clean, `npm test` passes (76 tests), and `npm run build` succeeds.
- **Headless Chrome over CDP**, production build, fresh profile. All 14 checks passed:
  1. **Nav:** the tutor sees Dashboard / Students / Monthly reports.
  2. **Students tab:** shows the list, Add a student and Groups.
  3. **Create a group:** "Friday readers" with Rosa and Luis gets `createdOn` today, and both members join today.
  4. **Edit the group:** renamed; Luis gets `leftOn` today and his record is kept; Amina joins today.
  5. **Delete the group:** `deletedOn` is today, it's gone from the Groups list, and the entry count is unchanged.
  6. **Schedule editor:** adding Friday to Rosa kept her original `from 2026-07-06` version and added one from today.
  7. **Walk-in:** a new student with no days is saved with an empty schedule.
  8. The walk-in's header shows "Walk-in".
  9. The printed sheet's Day(s) shows "Walk-in".
  10. The walk-in is not on the Today card.
  11. **Group on the Today card:** with Citizenship circle temporarily set to meet today (edited in the test profile's saved data), it appeared as one Today item with no member rows until clicked. **Log session** opened a row each for Amina and Luis.
  12. The schedule was then restored to Wednesday only, and the group left the Today card.
  13. **Staff nav:** only Monthly reports.
  14. **Staff redirects:** `/students` and `/students/s-amina` both go to `/reports`.

## Follow-up 4: fiscal-year strip removed

The user asked for the Jul–Jun month strip to be removed from the student page. It's gone, and so is `src/app/students/[id]/_components/FiscalYearStrip.tsx`. The calendar's own prev/next arrows move between months, and `?month=` deep links still work. The month summary now gets its status directly from `monthStatus(student, month, db.reports)`. Earlier sections that mention the strip are out of date.

## Follow-up 5: removing goals

- Each goal card on the goals board has a × button (`Remove "<goal>"`), next to its move arrows.
- Removing a goal deletes it and shows a toast with **Undo**. For an attained goal, the toast adds "It no longer counts as attained on reports."
- Undo calls the new `store.restoreGoal(goal)` (`m.restoreGoal`), which puts back the same goal with its id and dates. `m.removeGoal` is now a mutation like the others.
- **Tests:** remove, then undo, gives back an identical goal, and restoring twice doesn't duplicate it.
- **Browser (headless Chrome):** removing "Obtain high school diploma" on Amina's page took it off the board and out of the data, and Undo brought back the identical record.

## Follow-up 6: goal progress from the session panel

- The dashboard's session panel (`src/app/_components/SessionPanel.tsx`) now has a **Goals** section (`SessionGoals.tsx`) under the logging buttons. It lists the student's open goals, in-progress ones first.
- Each open goal gets one tap: **Start** for a goal not yet started, **Mark attained** for one in progress. Goals attained on that day stay listed with a tick.
- Progress is stamped with the **session's date** (`setGoalStage(goalId, stage, on?)`, which defaults to today), so logging last Thursday records progress on Thursday. On future days the buttons are hidden.
- Each change shows a toast with **Undo**. `restoreGoal` now puts back the exact earlier record, whether the goal was removed or moved to another stage.
- **Tests:** progress takes the session's date, and undo restores the exact previous record. 79 tests in total.
- **Browser (headless Chrome):** marking Started and then Attained on Amina's "Obtain high school diploma" stamped today's date. The Undo on the Attained toast put it back to in progress. The panel reads well at 390 px wide.
