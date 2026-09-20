"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalYearLabel } from "@/lib/fy";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";

const NAV = [
  { href: "/", label: "Tutoring log" },
  { href: "/reports", label: "Monthly reports" },
];

export function AppBar() {
  const { db, identity, setIdentity } = useStore();
  const pathname = usePathname();

  return (
    <header className="no-print sticky top-0 z-30 bg-ink text-porcelain">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-7 items-center justify-center rounded-sm bg-porcelain">
            <Image
              src="/lvaep-logo.png"
              alt=""
              width={119}
              height={146}
              className="h-7 w-auto"
              priority
            />
          </span>
          <span className="font-display text-2xl leading-none text-lime">LVAEP</span>
          <span className="hidden text-[13px] leading-none text-porcelain/70 sm:inline">
            Tutoring log · {fiscalYearLabel(CURRENT_FY)}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Button
                key={item.href}
                nativeButton={false}
                render={<Link href={item.href} />}
                size="sm"
                variant="ghost"
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "bg-lime text-ink hover:bg-lime"
                    : "text-porcelain/75 hover:bg-white/10 hover:text-porcelain"
                }
              >
                {item.label}
              </Button>
            );
          })}
        </nav>

        <label className="ml-auto flex items-center gap-2 text-[13px] text-porcelain/60">
          Signed in as
          <NativeSelect
            size="sm"
            value={identity.role === "staff" ? "staff" : identity.tutorId}
            onChange={(e) =>
              setIdentity(
                e.target.value === "staff"
                  ? { role: "staff" }
                  : { role: "tutor", tutorId: e.target.value },
              )
            }
            className="[&_select]:border-white/30 [&_select]:text-porcelain"
          >
            <NativeSelectOptGroup label="Tutor">
              {db.tutors.map((t) => (
                <NativeSelectOption key={t.id} value={t.id} className="text-ink">
                  {t.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
            <NativeSelectOptGroup label="Office">
              <NativeSelectOption value="staff" className="text-ink">
                LVAEP staff
              </NativeSelectOption>
            </NativeSelectOptGroup>
          </NativeSelect>
        </label>
      </div>
    </header>
  );
}
