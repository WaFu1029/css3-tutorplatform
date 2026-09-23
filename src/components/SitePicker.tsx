"use client";

import { SITES } from "@/lib/sites";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Picks one of LVAEP's tutoring sites. A record still holding a site that
 * isn't on the list keeps showing it, so nothing is silently rewritten.
 */
export function SitePicker({
  id,
  value,
  onChange,
  size,
  className,
}: {
  id?: string;
  value: string;
  onChange: (site: string) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  const names = SITES.map((s) => s.name);
  const options = names.includes(value) || !value ? names : [...names, value];

  return (
    <Select
      items={Object.fromEntries(options.map((n) => [n, n]))}
      value={value}
      onValueChange={(next: string | null) => next && onChange(next)}
    >
      <SelectTrigger id={id} size={size} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((n) => {
          const site = SITES.find((s) => s.name === n);
          return (
            <SelectItem key={n} value={n}>
              <span className="flex flex-col">
                <span>{n}</span>
                <span className="text-xs text-muted-foreground">
                  {site ? site.hoursLabel : "Not an LVAEP site"}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
