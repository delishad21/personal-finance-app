import { getMonthlyAnalytics } from "@/app/actions/analytics";
import { getTransactionYears } from "@/app/actions/transactions";
import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";

export default async function AnalyticsPage() {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const [initialData, availableYears] = await Promise.all([
    getMonthlyAnalytics(defaultYear, defaultMonth),
    getTransactionYears(),
  ]);

  const years =
    availableYears.length > 0
      ? availableYears
      : [defaultYear, defaultYear - 1];

  return (
    <AnalyticsClient initialData={initialData} availableYears={years} />
  );
}
