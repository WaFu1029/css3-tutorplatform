# Wordmuse identity kit

The Wordmuse UI, minus its colors, packaged to drop into another project.
Structure, typography, shape, elevation, and interaction come over one-to-one;
the palette ships as neutral placeholders for you to replace.

```
wordmuse-identity-kit/
├── tokens.css     Tailwind v4 token layer — palette slots, radius, shadows,
│                  type stack, base rules, grid background, highlight, keyframes
├── fonts.ts       self-hosted @fontsource imports + CSS-var mirror
├── STYLE.md       the rules in prose: buttons, hovers, menus, density, bans
└── ui/            the components, imports already rewritten to be path-agnostic
    ├── cn.ts          clsx + tailwind-merge
    ├── button.tsx     6 variants × 8 sizes (cva)
    ├── card.tsx       the borderless house card + section primitives (new here)
    ├── select.tsx     the "pill" dropdown — the most distinctive primitive
    ├── dialog.tsx     modal + close affordance
    ├── sheet.tsx      side panel
    ├── popover.tsx
    ├── tooltip.tsx    inverted, zero delay
    ├── skeleton.tsx   block / text / card loading shapes
    ├── command.tsx    ⌘K palette
    └── index.ts       barrel
```

## Install

```bash
npm i tailwindcss @tailwindcss/postcss radix-ui class-variance-authority \
      clsx tailwind-merge lucide-react cmdk \
      @fontsource/rubik @fontsource/eb-garamond
```

Requires **Tailwind v4** (the token layer uses `@theme inline` and
`@custom-variant`) and React 19-era `radix-ui` (the single unscoped package,
imported as `import { Select as SelectPrimitive } from "radix-ui"` — not the
old `@radix-ui/react-*` scoped packages). `cmdk` is only needed if you keep
`command.tsx`.

1. Copy `ui/` wherever your components live. Imports inside it are relative, so
   no path alias is required.
2. In your root stylesheet:
   ```css
   @import "tailwindcss";
   @import "./tokens.css";
   ```
3. Side-effect import `fonts.ts` once from the root layout.
4. Dark mode is class-based (`.dark` on `<html>`) — `next-themes` with
   `attribute="class"` is what Wordmuse uses.

## Making it yours

Open `tokens.css` and edit only the block marked **PALETTE — REPLACE**. Keep
these four relationships intact, because the components are tuned against them:

1. `--background` is an off-white, never `#fff`.
2. `--card` is clearly darker than `--background`, and cards carry **no border**.
3. `--card-hover` lands **between** `--background` and `--card`. A bigger step
   reads as a flash.
4. `--ring` equals `--primary`. Focus is brand-colored.

Also retint `--shadow-color` to your hue — the whole elevation ramp shares one
tinted shadow, which is why it doesn't read as generic gray.

Then read `STYLE.md` before writing anything new by hand. §10 is the reject
list.

## What was deliberately left out

Wordmuse-only material that would be noise in another product: the seven
`[data-accent]` theme blocks, chart tokens, ReactFlow and ProseMirror overrides,
editor line-spacing tokens (`--leading-115`, Google-Docs-matched), the Korean
Hangul font fallback (`fonts.ts` documents how to re-add one), and the
product-specific components (help widget, guide overlay, tutorial, voice
waveform).

Two pieces of Wordmuse chrome *did* come over because they're identity rather
than feature: `.grid-bg` (the fixed 44px ruled background) and `.mark-highlight`
(the marker-on-paper text highlight). Both are documented inline.
