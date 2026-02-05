import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const DATA_SERVICE_URL =
  process.env.DATA_SERVICE_URL || "http://localhost:4001";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") || "30";

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/analytics/dashboard?userId=${session.user.id}&timeframe=${timeframe}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: error.error || "Failed to fetch dashboard analytics" },
      { status: response.status },
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
