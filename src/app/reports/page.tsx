"use client";

import { useMemo, useState } from "react";
import { RequirePermission } from "@/components/RequirePermission";
import { can } from "@/lib/permissions";
import { CURRENT_FY, useStore } from "@/lib/store";
import { fiscalMonths, monthKey, todayISO } from "@/lib/fy";
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
  const months = useMemo(() => fiscalMonths(CURRENT_FY), []);
  const [month, setMonth] = useState(monthKey(todayISO()));

  // Staff read every tutor's reports and change none; tutors send their own.
  const View = can(identity, "reports:viewAll") ? StaffReports : TutorReports;
  return <View months={months} month={month} onMonth={setMonth} />;
}
