# The Wordmuse look, written down

Rules, not vibes. Everything below is what the components in `ui/` already do —
this file exists so new components you write by hand come out matching.

## 1. Type

| Role | Stack | Treatment |
|---|---|---|
| UI (default) | Rubik → `font-sans` | `letter-spacing: -0.03em` globally, on `body` |
| Editorial headings, pull quotes, wordmark | EB Garamond → `font-serif` | `tracking-tight`, `font-normal` or `500`, never bold |
| Long-form prose the user reads or writes | either | tracking back to `normal` via `.prose-surface` |

- **The negative tracking is the signature.** Rubik at `-0.03em` is what makes
  the interface read as set rather than typed. It is applied once, on `body`,
  and never overridden upward. Never add positive letter-spacing anywhere.
- **Serif is a moment, not a level.** Page titles, marketing headlines, a quote,
  the logo. Card titles, labels, table headers, buttons stay sans. A serif card
  title reads as a different product.
- Serif display sizes run `text-2xl` → `text-7xl` with `tracking-tight` and
  `leading-tight`. Sans UI text lives almost entirely in `text-sm` (labels,
  buttons, body) and `text-xs` (meta, tooltips, badges).
- Weight does the emphasis: `font-medium` (500) for anything interactive or
  labelled, `font-semibold` (600) sparingly, `font-bold` almost never in sans.
- Muted text is `text-muted-foreground`, and when it belongs to something
  hoverable it goes `hover:text-foreground`. That pair is the most-used hover
  in the whole app — an icon or meta row brightening to full ink.

## 2. Shape

One radius scale, derived from `--radius: 0.375rem`:

| Utility | Size | Use |
|---|---|---|
| `rounded-sm` | 2px | inner rows inside a menu |
| `rounded-md` | 6px | **the default** — buttons, inputs, menus, popovers, tooltips, chips |
| `rounded-lg` | 6px+ | dialogs |
| `rounded-xl` | 10px | cards, panels |
| `rounded-full` | — | avatars, dots, status pills, icon-only toggles |

Radius steps up with the element's size. A card at button radius reads as an
oversized button; a button at card radius reads soft and imprecise.

## 3. Surfaces

- **Cards are borderless.** `bg-card` alone separates them. Adding a border on
  top of the fill is two separators doing one job, and it is exactly what makes
  a UI read as boxes inside boxes.
- **`--card-hover` is a small step, on purpose.** It sits between `--background`
  and `--card`, so a card on the page darkens just past its wrapper and a card
  on a filled section lightens just short of the page. Buttons and menu rows do
  NOT use it — they take the stronger `muted` hover.
- Fields sit on `--input-surface` (brighter than the page in light, darker in
  dark), with a `--input` border.
- Rails, splitters, and panel edges use `--panel-border`, which is a step
  stronger than `--border`. Regular borders inherit `--border` automatically
  from the base layer, so a bare `border` utility is already right.
- Use elevation before a border. If a surface needs more presence, go up the
  shadow ramp; don't outline it.
- Frosted chrome (sticky headers, floating control clusters):
  `backdrop-blur-[4px]` plus `color-mix(in oklab, var(--background) 80%, transparent)`,
  one `--border` hairline, no shadow. `color-mix`, not `hsl()` — the tokens are
  oklch.

## 4. Buttons

See `ui/button.tsx`. Six variants, eight sizes, and the hover rule differs per
variant:

| Variant | Rest | Hover |
|---|---|---|
| `default` | `bg-primary text-primary-foreground` | `bg-primary/90` — opacity step, not a new color |
| `outline` | `border bg-background shadow-xs` | `bg-accent text-accent-foreground` |
| `secondary` | `bg-secondary` | `bg-secondary/80` |
| `ghost` | transparent | `bg-accent` (dark: `bg-accent/50`) |
| `destructive` | `bg-destructive text-white` | `bg-destructive/90`, ring goes destructive |
| `link` | `text-primary` | `underline` with `underline-offset-4` |

- **Hover = an opacity step on the same fill.** A filled button never changes
  hue on hover.
- Heights: `h-6` (xs) · `h-8` (sm) · `h-9` (default) · `h-10` (lg), with square
  `size-*` twins for icon-only. Default UI sits at `h-9` / `text-sm` /
  `font-medium`.
- Icons are auto-sized (`size-4`, `size-3` at xs) and gapped at `gap-2`. Padding
  tightens automatically when a button contains an icon
  (`has-[>svg]:px-3`) — don't hand-tune it.
- Focus is one treatment everywhere: `focus-visible:ring-ring/50
  focus-visible:ring-[3px]` plus `focus-visible:border-ring`. Brand-colored,
  3px, soft. Never remove it.
- Disabled is `opacity-50` + `pointer-events-none`. Because pointer events are
  off, a `title` or tooltip on the button itself will never fire — wrap the
  button in a span and put the tooltip there when a disabled control needs to
  explain itself.

## 5. Dropdowns and menus

The "pill" trigger (`ui/select.tsx`) is house style and is deliberately unlike
stock shadcn:

- **Borderless muted pill**: `bg-muted/30 hover:bg-muted/60`, transparent
  border kept only so a caller that re-adds a border color doesn't shift layout.
- **No shadow** on the trigger.
- **Text stays `text-foreground`** at `font-medium`. Color never lives in the
  label — a colored status shows as a **dot** next to normal-colored text.
  Tinted text in a trigger is banned.
- Chevron is `size-4 opacity-50`, muted.
- Menu panels: `bg-popover`, `rounded-md`, one border, `shadow-md`, and a
  viewport padded `px-1.5 py-1` — px greater than py, so the row highlight never
  reads as touching the panel edges.
- Rows: `rounded-sm`, `text-sm`, `focus:bg-muted focus:text-foreground`, icons
  muted at `size-4`.

## 6. Overlays

- Dialog: `bg-black/50` scrim, panel is `rounded-lg border bg-background p-6
  shadow-lg`, `gap-4` grid, close button top-right at `rounded-md p-1
  opacity-70 hover:bg-muted hover:opacity-100`.
- Tooltip: inverted — `bg-foreground text-background`, `text-xs`, `rounded-md
  px-3 py-1.5`, with a rotated `size-2.5` arrow. Delay is **0**; tooltips in
  this system appear instantly.
- Every overlay animates with the same four-part recipe: `fade-in-0`,
  `zoom-in-95`, a 2px directional `slide-in-from-*`, and the mirrored `*-out`
  pair on close.

## 7. Motion

- `transition-colors` is the default and covers the large majority of states.
  `transition-opacity` and `transition-transform` for the rest;
  `transition-all` only where a control genuinely changes several axes.
- Durations stay short (120–200ms). No easing curves with personality, no
  spring physics, no hover lift, no scale-on-hover on cards.
- Keyframes ship for three things only: a typing wave, a thinking fade, and a
  field reveal. Decorative loops don't belong.
- Honor `prefers-reduced-motion`.

## 8. Color discipline

- The accent signals **action, focus, and identity**. It is not a page fill and
  not a decorative gradient. A typical screen shows it on one primary button,
  the focus ring, and maybe a marker highlight.
- `--ring` equals the accent: focus is brand-colored, everywhere, always.
- Status color goes on a dot, a small badge, or a highlight fill — not on body
  text and not on a control's label.
- No purple AI glow, no glassmorphism outside the one frosted-chrome recipe, no
  multi-stop gradients, no drop shadows in a different hue than the ramp.

## 9. Density and layout

- Vertical rhythm is `space-y-3` inside a card, `space-y-6`/`space-y-8` between
  page sections. Card padding is `p-5` (`p-4` when dense, `p-6` for a dialog).
- Sections are unfilled: heading plus spacing, no wrapper card. Reserve the fill
  for the cards inside them.
- Empty states get a line of plain sentence-case copy in
  `text-sm text-muted-foreground` and, at most, one button. No illustrations.
- Copy is sentence case throughout — buttons, labels, menu items, headings. No
  ALL-CAPS labels, no title case.

## 10. What to reject in review

A change is off-identity if it: puts a border on a card · uses a serif for UI
chrome · adds positive letter-spacing · colors a dropdown's label text · hovers
with a new hue instead of an opacity step · removes the 3px focus ring ·
introduces a one-off radius, shadow, or hex value instead of a token · fills a
page with the accent · adds a hover lift, scale, or spring.
