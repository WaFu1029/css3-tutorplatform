import * as React from "react"

import { cn } from "./cn"

/**
 * The house card. Two rules carry the identity:
 *
 * 1. BORDERLESS. The `--card` fill is what separates the card from the page,
 *    so a border on top of it is a second separator doing the same job — that
 *    is what makes a UI read as "boxes inside boxes". If a card needs more
 *    weight, raise the shadow, don't add a rule.
 * 2. Radius steps UP with size. Controls are `rounded-md` (6px), cards are
 *    `rounded-xl` (10px). A card at the control radius reads as an oversized
 *    button.
 *
 * `interactive` turns the whole card into a click target and swaps the fill to
 * `--card-hover`, which is deliberately a SMALL step — it lands between the
 * page and the card, so the card moves toward its neighbour rather than
 * flashing past it. Buttons and menu rows keep the stronger `muted` hover.
 */
function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl bg-card p-5 text-card-foreground",
        interactive && "cursor-pointer transition-colors hover:bg-card-hover",
        className
      )}
      {...props}
    />
  )
}

/** Title row. Sans, medium, tight — not a serif moment. Serif is for editorial
 *  headings (page titles, marketing, pull quotes), not for card chrome. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("mb-3 flex items-center justify-between gap-2", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/**
 * Section wrapper for a page region. Sections do NOT get the card fill — they
 * sit on the page and let their heading and spacing do the work. Nesting a card
 * inside a filled section is the one arrangement `--card-hover` was tuned for.
 */
function Section({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("space-y-3", className)}
      {...props}
    />
  )
}

/** Small-caps-free section label: muted, small, medium weight. The house
 *  alternative to a bold black subheading. */
function SectionLabel({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="section-label"
      className={cn("text-sm font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, Section, SectionLabel }
