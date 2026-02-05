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
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!year || !month) {
    return NextResponse.json(
      { error: "year and month are required" },
      { status: 400 },
    );
  }

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/analytics/monthly?userId=${session.user.id}&year=${year}&month=${month}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: error.error || "Failed to fetch monthly analytics" },
      { status: response.status },
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
