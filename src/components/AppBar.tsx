"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CURRENT_FY, useStore } from "@/lib/store";
import { landingFor, navFor } from "@/lib/permissions";
import { fiscalYearLabel } from "@/lib/fy";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppBar() {
  const { db, identity, setIdentity } = useStore();
  const pathname = usePathname();
  const nav = navFor(identity);
  const identityLabels = {
    ...Object.fromEntries(db.tutors.map((t) => [t.id, t.name])),
    staff: "LVAEP staff",
  };

  return (
    // Frosted chrome: a translucent page fill, one hairline, no shadow, so the
    // ruled background reads through the header instead of being covered.
    <header className="no-print sticky top-0 z-30 border-b bg-[color-mix(in_oklab,var(--background)_80%,transparent)] backdrop-blur-[4px]">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-2.5">
        <Link href={landingFor(identity)} className="flex items-center gap-2.5">
          <Image
            src="/lvaep-logo.png"
            alt=""
            width={119}
            height={146}
            className="h-7 w-auto"
            priority
          />
          <span className="font-serif text-2xl leading-none tracking-tight">LVAEP</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Tutoring log · {fiscalYearLabel(CURRENT_FY)}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {nav.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Button
                key={item.href}
                nativeButton={false}
                render={<Link href={item.href} />}
                size="sm"
                variant={active ? "secondary" : "ghost"}
                aria-current={active ? "page" : undefined}
                className={active ? undefined : "text-muted-foreground hover:text-foreground"}
              >
                {item.label}
              </Button>
            );
          })}
        </nav>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Signed in as
          <Select
            items={identityLabels}
            value={identity.role === "staff" ? "staff" : identity.tutorId}
            onValueChange={(value: string | null) =>
              setIdentity(
                value === "staff" || value === null
                  ? { role: "staff" }
                  : { role: "tutor", tutorId: value },
              )
            }
          >
            <SelectTrigger size="sm" className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Tutor</SelectLabel>
                {db.tutors.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Office</SelectLabel>
                <SelectItem value="staff">LVAEP staff</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
      </div>
    </header>
  );
}
