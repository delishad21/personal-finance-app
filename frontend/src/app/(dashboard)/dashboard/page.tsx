import { getDashboardAnalytics } from "@/app/actions/analytics";
import { DashboardClient } from "@/components/analytics/DashboardClient";

export default async function DashboardPage() {
  const initialData = await getDashboardAnalytics(30);

  return (
    <DashboardClient initialData={initialData} />
  );
}
