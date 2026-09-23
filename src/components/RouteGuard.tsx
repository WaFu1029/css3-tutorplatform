"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { canOpenPath, landingFor } from "@/lib/permissions";

/**
 * Wraps every page. When the signed-in role may not open the current path —
 * staff on the tutoring log or a student page, or a tutor on another tutor's
 * student — nothing renders and the role is sent to its landing page.
 *
 * Like `RequirePermission`, this shapes the UI; it is not a security boundary
 * (see the scope note in `lib/permissions.ts`).
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { db, identity, ready } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canOpenPath(db, identity, pathname);

  useEffect(() => {
    // Wait for the stored identity, or a staff reload would be judged as the
    // default tutor first.
    if (ready && !allowed) router.replace(landingFor(identity));
  }, [ready, allowed, identity, router]);

  if (!ready || !allowed) return null;
  return <>{children}</>;
}
