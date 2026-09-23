"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/RequirePermission";
import { can } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import { monthKey, todayISO } from "@/lib/fy";
import { StaffReports } from "./_components/StaffReports";
import { TutorReports } from "./_components/TutorReports";

export default function ReportsPage() {
  return (
    <RequirePermission permission="reports:view">
      <Reports />
    </RequirePermission>
  );
}

function Reports() {
  const { identity } = useStore();
  const [month, setMonth] = useState(monthKey(todayISO()));

  // Staff read every tutor's reports and change none; tutors send their own.
  const View = can(identity, "reports:viewAll") ? StaffReports : TutorReports;
  return <View month={month} onMonth={setMonth} />;
}
