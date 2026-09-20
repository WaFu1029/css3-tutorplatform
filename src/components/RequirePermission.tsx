"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { can, landingFor, type Permission } from "@/lib/permissions";

/**
 * Keeps a page's contents from rendering for a role that may not see it, and
 * sends that role somewhere it may go. This tidies the UI; it does not secure
 * the data behind it.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { identity, ready } = useStore();
  const router = useRouter();
  const allowed = can(identity, permission);

  useEffect(() => {
    // Wait for the stored identity to load, or a staff reload of the log would
    // redirect off the default tutor identity before the real one arrives.
    if (ready && !allowed) router.replace(landingFor(identity));
  }, [ready, allowed, identity, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
