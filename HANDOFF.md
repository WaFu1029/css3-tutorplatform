# Handoff

Each session adds its own section. Edit only yours.

## Session 3: Monthly reports, roles, route guards, staff view

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

### What landed

| File | What |
| --- | --- |
| `src/app/students/[id]/page.tsx` | Student page. `StudentSidebar` on the left. On the right: header, then `LoggingBar` (keyed by student and preselected with them), then `GoalsColumn` (about 1/4 width) beside the attendance area. The attendance area has the fiscal-year strip, the calendar, and the month summary. Reads `?month=YYYY-MM` and follows it when it changes. The attendance section has `id="month-YYYY-MM"`. |
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
