"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

type Category = { id: string; name: string; color: string };

interface MonthlyAnalyticsData {
  period: { year: number; month: number };
  totals: { totalIn: number; totalOut: number; net: number };
  dailySeries: Array<{ date: string; in: number; out: number }>;
  categoryBreakdown: Array<{
    category: Category | null;
    totalIn: number;
    totalOut: number;
  }>;
  trendSeries: Array<{ month: string; totalOut: number }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    label?: string | null;
    amountIn: number;
    amountOut: number;
    category: Category | null;
  }>;
}

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 2,
  }).format(value);

export function AnalyticsClient({
  initialData,
  availableYears,
}: {
  initialData: MonthlyAnalyticsData;
  availableYears: number[];
}) {
  const [data, setData] = useState<MonthlyAnalyticsData>(initialData);
  const [loading, setLoading] = useState(false);

  const yearOptions = availableYears.map((year) => ({
    value: String(year),
    label: String(year),
  }));

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: format(new Date(2024, i, 1), "MMMM"),
  }));

  const dailySeries = useMemo(
    () =>
      data.dailySeries.map((item) => ({
        ...item,
        in: toNumber(item.in),
        out: toNumber(item.out),
        label: format(parseISO(item.date), "dd MMM"),
      })),
    [data.dailySeries],
  );

  const categorySeries = useMemo(() => {
    const sorted = [...data.categoryBreakdown].sort(
      (a, b) => b.totalOut - a.totalOut,
    );
    return sorted.slice(0, 8).map((item) => ({
      name: item.category?.name || "Uncategorized",
      totalIn: item.totalIn,
      totalOut: item.totalOut,
      color: item.category?.color || "#9ca3af",
    }));
  }, [data.categoryBreakdown]);

  const pieData = useMemo(
    () =>
      categorySeries.map((item) => ({
        name: item.name,
        value: item.totalOut,
        color: item.color,
      })),
    [categorySeries],
  );

  const handleSelectionChange = async (
    year: string,
    month: string,
  ) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/monthly?year=${year}&month=${month}`,
      );
      const json = await response.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Date",
      "Label",
      "Description",
      "Category",
      "Amount In",
      "Amount Out",
    ];
    const rows = data.transactions.map((tx) => [
      format(parseISO(String(tx.date)), "yyyy-MM-dd"),
      tx.label || "",
      tx.description,
      tx.category?.name || "Uncategorized",
      tx.amountIn ? tx.amountIn.toFixed(2) : "",
      tx.amountOut ? tx.amountOut.toFixed(2) : "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-${data.period.year}-${String(
      data.period.month,
    ).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-dark dark:text-white">
            Monthly Analytics
          </h2>
          <p className="text-sm text-dark-5 dark:text-dark-6">
            Detailed breakdown of your monthly performance.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={String(data.period.month)}
            options={monthOptions}
            onChange={(value) =>
              handleSelectionChange(String(data.period.year), value)
            }
            buttonClassName="min-w-[180px]"
          />
          <Select
            value={String(data.period.year)}
            options={yearOptions}
            onChange={(value) =>
              handleSelectionChange(value, String(data.period.month))
            }
            buttonClassName="min-w-[140px]"
          />
          <Button variant="primary" onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-dark-5 dark:text-dark-6">
              Total In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green">
              {formatCurrency(data.totals.totalIn)}
            </div>
            <p className="text-xs text-dark-5 dark:text-dark-6 mt-2">
              Total income for the month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-dark-5 dark:text-dark-6">
              Total Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red">
              {formatCurrency(data.totals.totalOut)}
            </div>
            <p className="text-xs text-dark-5 dark:text-dark-6 mt-2">
              Total spending for the month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-dark-5 dark:text-dark-6">
              Net Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                data.totals.net >= 0 ? "text-green" : "text-red"
              }`}
            >
              {formatCurrency(data.totals.net)}
            </div>
            <p className="text-xs text-dark-5 dark:text-dark-6 mt-2">
              Income minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <Card className="min-h-[360px]">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Daily Cash Flow</CardTitle>
            {loading && (
              <span className="text-xs text-dark-5 dark:text-dark-6">
                Updating...
              </span>
            )}
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-stroke)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--color-dark-5)" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-dark-5)" }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(Number(value))}
                  contentStyle={{
                    backgroundColor: "var(--color-white)",
                    border: "1px solid var(--color-stroke)",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="in"
                  stroke="#22AD5C"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="out"
                  stroke="#F23030"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-h-[360px]">
          <CardHeader>
            <CardTitle>Category Split</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(Number(value))}
                  contentStyle={{
                    backgroundColor: "var(--color-white)",
                    border: "1px solid var(--color-stroke)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="min-h-[360px]">
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categorySeries} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-stroke)"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: "var(--color-dark-5)" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: "var(--color-dark-5)" }}
                width={120}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--color-white)",
                  border: "1px solid var(--color-stroke)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="totalOut" fill="#5750F1" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle>Spending Trend (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trendSeries}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-stroke)"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "var(--color-dark-5)" }}
              />
              <YAxis tick={{ fontSize: 12, fill: "var(--color-dark-5)" }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--color-white)",
                  border: "1px solid var(--color-stroke)",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="totalOut"
                stroke="#5750F1"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
