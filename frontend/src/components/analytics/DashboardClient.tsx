"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

type Category = { id: string; name: string; color: string };

interface DashboardData {
  timeframeDays: number;
  totals: { totalIn: number; totalOut: number; net: number };
  series: Array<{ date: string; in: number; out: number }>;
  categoryBreakdown: Array<{ category: Category | null; totalOut: number }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    label?: string | null;
    amountIn?: number | string | null;
    amountOut?: number | string | null;
    category?: Category | null;
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

const timeframeOptions = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);

  const series = useMemo(
    () =>
      data.series.map((item) => ({
        ...item,
        in: toNumber(item.in),
        out: toNumber(item.out),
        label: format(parseISO(item.date), "dd MMM"),
      })),
    [data.series],
  );

  const pieData = useMemo(() => {
    const top = data.categoryBreakdown.slice(0, 6);
    const rest = data.categoryBreakdown.slice(6);
    const restTotal = rest.reduce((acc, item) => acc + item.totalOut, 0);
    const result = top.map((item) => ({
      name: item.category?.name || "Uncategorized",
      value: item.totalOut,
      color: item.category?.color || "#9ca3af",
    }));
    if (restTotal > 0) {
      result.push({ name: "Others", value: restTotal, color: "#CBD5E1" });
    }
    return result;
  }, [data.categoryBreakdown]);

  const recentTransactions = useMemo(
    () =>
      data.recentTransactions.map((tx) => ({
        ...tx,
        amountIn: toNumber(tx.amountIn),
        amountOut: toNumber(tx.amountOut),
      })),
    [data.recentTransactions],
  );

  const handleTimeframeChange = async (value: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/dashboard?timeframe=${value}`);
      const json = await response.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-dark dark:text-white">
            Overview
          </h2>
          <p className="text-sm text-dark-5 dark:text-dark-6">
            A quick look at your income and spending.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Select
            value={String(data.timeframeDays)}
            options={timeframeOptions}
            onChange={handleTimeframeChange}
            buttonClassName="w-full"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              Inflow over the selected period
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
              Spending over the selected period
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
            <CardTitle>Cash Flow</CardTitle>
            {loading && (
              <span className="text-xs text-dark-5 dark:text-dark-6">
                Updating...
              </span>
            )}
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 8, right: 16 }}>
                <defs>
                  <linearGradient id="inGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22AD5C" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22AD5C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F23030" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F23030" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  labelFormatter={(label) => `Day ${label}`}
                  contentStyle={{
                    backgroundColor: "var(--color-white)",
                    border: "1px solid var(--color-stroke)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="in"
                  stroke="#22AD5C"
                  fill="url(#inGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  stroke="#F23030"
                  fill="url(#outGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-h-[360px]">
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col gap-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      formatCurrency(Number(value))
                    }
                    contentStyle={{
                      backgroundColor: "var(--color-white)",
                      border: "1px solid var(--color-stroke)",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.slice(0, 4).map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-dark dark:text-white">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-sm text-dark-5 dark:text-dark-6">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-stroke dark:divide-dark-3">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-dark dark:text-white truncate">
                    {tx.label || tx.description}
                  </div>
                  <div className="text-xs text-dark-5 dark:text-dark-6">
                    {format(parseISO(String(tx.date)), "dd MMM yyyy")} •{" "}
                    {tx.category?.name || "Uncategorized"}
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold ${
                    tx.amountIn && tx.amountIn > 0 ? "text-green" : "text-red"
                  }`}
                >
                  {tx.amountIn && tx.amountIn > 0
                    ? `+${formatCurrency(tx.amountIn)}`
                    : `-${formatCurrency(tx.amountOut || 0)}`}
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <div className="py-10 text-center text-sm text-dark-5 dark:text-dark-6">
                No recent transactions yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
