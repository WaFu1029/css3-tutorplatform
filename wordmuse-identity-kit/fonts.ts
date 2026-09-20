/**
 * Self-hosted faces, imported once from the root layout (a side-effect import:
 * `import "@/styles/fonts";`). @fontsource ships the files with the app, so
 * there is no network fetch at build time and no Google Fonts request at
 * runtime.
 *
 * Install:
 *   npm i @fontsource/rubik @fontsource/eb-garamond
 *
 * Weights are not decorative — each one is used:
 *   Rubik 400 body · 500 buttons/labels · 600 emphasis · 700 rare display
 *   EB Garamond 400/500 editorial headings and pull quotes, 400-italic and
 *   500-italic for real italic display type.
 *
 * Ship the italic faces if you set any serif italic above ~20px. Without them
 * the browser fake-slants the upright face, which is visibly wrong at display
 * sizes — and a 500-weight italic falls back to 400-italic, rendering a step
 * lighter than the upright letters beside it.
 */
import "@fontsource/rubik/400.css"
import "@fontsource/rubik/500.css"
import "@fontsource/rubik/600.css"
import "@fontsource/rubik/700.css"
import "@fontsource/eb-garamond/400.css"
import "@fontsource/eb-garamond/400-italic.css"
import "@fontsource/eb-garamond/500.css"
import "@fontsource/eb-garamond/500-italic.css"

import type { CSSProperties } from "react"

/**
 * Spread onto <html style={...}> when you want the stacks addressable as CSS
 * vars outside Tailwind (an editor's font dropdown, an inline style, a canvas).
 * These must stay in sync with --font-sans / --font-serif in tokens.css — in
 * Wordmuse they have drifted apart before.
 *
 * Add a script-specific fallback AFTER Rubik if the product carries non-Latin
 * copy (Wordmuse appends "Noto Sans KR" for Hangul). Import that font's
 * SUBSET file, not its default entry: the default declares ~124
 * unicode-range-partitioned @font-face blocks per weight and ships ~100 KB of
 * render-blocking CSS to readers who never see the script. The font stack is
 * what makes it lazy, not unicode-range.
 */
export const fontVariables = {
  "--font-sans": "'Rubik', ui-sans-serif, system-ui, sans-serif",
  "--font-serif":
    "'EB Garamond', Georgia, Cambria, 'Times New Roman', serif",
  "--font-mono":
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as CSSProperties
