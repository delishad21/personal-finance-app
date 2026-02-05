"use server";

import { auth } from "@/lib/auth";

const DATA_SERVICE_URL =
  process.env.DATA_SERVICE_URL || "http://localhost:4001";

export async function getDashboardAnalytics(timeframeDays: number = 30) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/analytics/dashboard?userId=${session.user.id}&timeframe=${timeframeDays}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch dashboard analytics");
  }

  return response.json();
}

export async function getMonthlyAnalytics(year: number, month: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/analytics/monthly?userId=${session.user.id}&year=${year}&month=${month}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch monthly analytics");
  }

  return response.json();
}
