/**
 * Self-hosted faces from the Wordmuse identity kit, imported once from the root
 * layout as a side effect. @fontsource ships the files with the app: no Google
 * Fonts request at runtime.
 *
 * Rubik 400 body · 500 buttons/labels · 600 emphasis.
 * EB Garamond 400/500 for the editorial moments — the wordmark and page titles.
 * Italic faces ship because the printed sheet sets serif italic above 20px, and
 * without them the browser fake-slants the upright face.
 */
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/600.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/500.css";

import type { CSSProperties } from "react";

/**
 * Spread onto <html style={...}> so the stacks are addressable outside
 * Tailwind. Must stay in sync with --font-sans / --font-serif in globals.css.
 */
export const fontVariables = {
  "--font-sans": "'Rubik', ui-sans-serif, system-ui, sans-serif",
  "--font-serif": "'EB Garamond', Georgia, Cambria, 'Times New Roman', serif",
  "--font-mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as CSSProperties;
