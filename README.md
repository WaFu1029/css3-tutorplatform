# LVAEP Tutoring Log

A replacement for the paper *Student Monthly Attendance & Achievement Form* used by
Literacy Volunteers of America, Essex/Passaic County. Tutors record each session as it
happens; the office gets the monthly numbers without chasing sheets.

The original form is kept in [`docs/`](./docs) for reference.

## What the prototype does

**Tutors** (`/`)
- **Quick log** — student, date, hours, save. Or one tap for student absent, tutor absent, holiday.
- **Year ledger** — the same 31 × 12 grid as the paper form, for the fiscal year (July–June).
  Click a box and type: digits set hours, `T` / `S` / `H` set absence codes, `⌫` clears, arrows
  move. Monthly totals and a year-to-date total compute themselves. Future dates are locked.
- **Achievements** — the A–E checklist from the form, with the date each goal was attained.
- **Month close** — hours, sessions and missed sessions for the current month, one button to
  send it to the office, and a twelve-month strip showing which months are still open.
- **Where and when** — site, days, times, and the "stopped being tutored" flag with a reason.

**Office staff** (`/reports`)
- Any month of the fiscal year, filtered by tutor: hours, sessions, missed sessions, goals
  attained, and which sheets are still outstanding.
- CSV export for the month.
- Add a student and assign them to a tutor.

**Printable sheet** (`/students/[id]/sheet`)
- A facsimile of the paper form, filled in from the logged data, for anything that still has to
  be filed on paper.

Use the **Signed in as** control in the header to switch between tutors and the office.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

## How it is built

- Next.js (App Router) + TypeScript + Tailwind v4
- shadcn/ui components (`src/components/ui`), themed to the LVAEP palette in
  `src/app/globals.css`: ink `#000807`, lime `#C5D86D`, porcelain `#F7F7F2`
- Archivo for the interface, Instrument Serif for headings

### Prototype limits

There is no server and no accounts. All data lives in `localStorage` under
`lvaep.tutorlog.v1`, seeded with demo tutors, students and sessions from
`src/lib/seed.ts`. Clearing site data resets everything to the seed. Before this goes to real
tutors it needs a database, authentication, and the office being notified when a student stops.

### Where things are

| Path | What is there |
| --- | --- |
| `src/lib/types.ts` | Tutor, student, entry, submission shapes |
| `src/lib/fy.ts` | Fiscal-year (July–June) date helpers |
| `src/lib/goals.ts` | The achievement checklist from the form |
| `src/lib/store.tsx` | Client store, persistence, selectors |
| `src/lib/seed.ts` | Demo data |
| `src/components/Ledger.tsx` | The keyboard-driven attendance grid |
| `src/app/reports/page.tsx` | Office view and CSV export |
| `src/app/students/[id]/sheet/page.tsx` | Printable form |
