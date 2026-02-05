import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";

export const analyticsRouter = Router();

const toNumber = (value: any) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
};

const formatDayKey = (date: Date) => date.toISOString().slice(0, 10);

const buildDailySeries = (start: Date, end: Date) => {
  const days: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  while (cursor <= endDate) {
    days.push(formatDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

/**
 * GET /api/analytics/dashboard
 * Summary analytics for dashboard
 */
analyticsRouter.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const { userId, timeframe } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const timeframeDays = Math.max(Number(timeframe || 30), 1);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (timeframeDays - 1));
    startDate.setHours(0, 0, 0, 0);

    const [transactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: userId as string,
          date: { gte: startDate, lte: endDate },
        },
        include: { category: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const totals = transactions.reduce(
      (acc, tx) => ({
        totalIn: acc.totalIn + toNumber(tx.amountIn),
        totalOut: acc.totalOut + toNumber(tx.amountOut),
      }),
      { totalIn: 0, totalOut: 0 },
    );

    const days = buildDailySeries(startDate, endDate);
    const seriesMap = new Map(
      days.map((day) => [day, { date: day, in: 0, out: 0 }]),
    );

    const categoryMap = new Map<
      string,
      { category: any; totalOut: number }
    >();

    transactions.forEach((tx) => {
      const dayKey = formatDayKey(tx.date);
      const entry = seriesMap.get(dayKey);
      if (entry) {
        entry.in += toNumber(tx.amountIn);
        entry.out += toNumber(tx.amountOut);
      }

      const categoryId = tx.categoryId || "uncategorized";
      const category =
        tx.category ||
        (tx.categoryId
          ? null
          : { id: "uncategorized", name: "Uncategorized", color: "#9ca3af" });
      const current = categoryMap.get(categoryId) || {
        category,
        totalOut: 0,
      };
      current.totalOut += toNumber(tx.amountOut);
      categoryMap.set(categoryId, current);
    });

    const categoryBreakdown = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalOut - a.totalOut,
    );

    const recentTransactions = await prisma.transaction.findMany({
      where: { userId: userId as string },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 6,
    });

    res.json({
      timeframeDays,
      totals: {
        ...totals,
        net: totals.totalIn - totals.totalOut,
      },
      series: Array.from(seriesMap.values()),
      categoryBreakdown,
      recentTransactions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/monthly
 * Detailed analytics for selected month
 */
analyticsRouter.get("/monthly", async (req: Request, res: Response) => {
  try {
    const { userId, year, month } = req.query;
    if (!userId || !year || !month) {
      return res
        .status(400)
        .json({ error: "userId, year, and month are required" });
    }

    const yearNum = parseInt(year as string, 10);
    const monthNum = parseInt(month as string, 10);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);
    endDate.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: userId as string,
        date: { gte: startDate, lte: endDate },
      },
      include: { category: true },
      orderBy: { date: "asc" },
    });

    const totals = transactions.reduce(
      (acc, tx) => ({
        totalIn: acc.totalIn + toNumber(tx.amountIn),
        totalOut: acc.totalOut + toNumber(tx.amountOut),
      }),
      { totalIn: 0, totalOut: 0 },
    );

    const days = buildDailySeries(startDate, endDate);
    const seriesMap = new Map(
      days.map((day) => [day, { date: day, in: 0, out: 0 }]),
    );

    const categoryMap = new Map<
      string,
      { category: any; totalIn: number; totalOut: number }
    >();

    transactions.forEach((tx) => {
      const dayKey = formatDayKey(tx.date);
      const entry = seriesMap.get(dayKey);
      if (entry) {
        entry.in += toNumber(tx.amountIn);
        entry.out += toNumber(tx.amountOut);
      }

      const categoryId = tx.categoryId || "uncategorized";
      const category =
        tx.category ||
        (tx.categoryId
          ? null
          : { id: "uncategorized", name: "Uncategorized", color: "#9ca3af" });
      const current = categoryMap.get(categoryId) || {
        category,
        totalIn: 0,
        totalOut: 0,
      };
      current.totalIn += toNumber(tx.amountIn);
      current.totalOut += toNumber(tx.amountOut);
      categoryMap.set(categoryId, current);
    });

    const categoryBreakdown = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalOut - a.totalOut,
    );

    const trendMonths = 6;
    const trendStart = new Date(yearNum, monthNum - trendMonths, 1);
    const trendEnd = new Date(yearNum, monthNum, 0);
    trendEnd.setHours(23, 59, 59, 999);

    const trendTransactions = await prisma.transaction.findMany({
      where: {
        userId: userId as string,
        date: { gte: trendStart, lte: trendEnd },
      },
      orderBy: { date: "asc" },
    });

    const trendSeries: Array<{ month: string; totalOut: number }> = [];
    for (let i = trendMonths - 1; i >= 0; i--) {
      const monthStart = new Date(yearNum, monthNum - 1 - i, 1);
      const monthEnd = new Date(yearNum, monthNum - i, 0);
      monthEnd.setHours(23, 59, 59, 999);

      const monthTx = trendTransactions.filter(
        (tx) => tx.date >= monthStart && tx.date <= monthEnd,
      );
      const totalOut = monthTx.reduce(
        (acc, tx) => acc + toNumber(tx.amountOut),
        0,
      );
      trendSeries.push({
        month: `${monthStart.getFullYear()}-${String(
          monthStart.getMonth() + 1,
        ).padStart(2, "0")}`,
        totalOut,
      });
    }

    res.json({
      period: { year: yearNum, month: monthNum },
      totals: { ...totals, net: totals.totalIn - totals.totalOut },
      dailySeries: Array.from(seriesMap.values()),
      categoryBreakdown,
      trendSeries,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        label: tx.label,
        amountIn: toNumber(tx.amountIn),
        amountOut: toNumber(tx.amountOut),
        category: tx.category
          ? { id: tx.category.id, name: tx.category.name, color: tx.category.color }
          : null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/monthly-summary
 * Get monthly spending summary
 */
analyticsRouter.get("/monthly-summary", async (req: Request, res: Response) => {
  try {
    const { userId, year, month } = req.query;

    if (!userId || !year || !month) {
      return res
        .status(400)
        .json({ error: "userId, year, and month are required" });
    }

    const startDate = new Date(
      parseInt(year as string),
      parseInt(month as string) - 1,
      1,
    );
    const endDate = new Date(
      parseInt(year as string),
      parseInt(month as string),
      0,
    );

    // Get category breakdown
    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId: userId as string,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amountIn: true,
        amountOut: true,
      },
    });

    // Get category details
    const categoryIds = categoryBreakdown
      .map((c: any) => c.categoryId)
      .filter((id: any): id is string => id !== null);

    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
      },
    });

    const categoryMap = new Map(categories.map((c: any) => [c.id, c]));

    // Format response
    const breakdown = categoryBreakdown.map((item: any) => ({
      category: item.categoryId ? categoryMap.get(item.categoryId) : null,
      totalIn: item._sum.amountIn?.toNumber() || 0,
      totalOut: item._sum.amountOut?.toNumber() || 0,
    }));

    // Calculate totals
    const totals = breakdown.reduce(
      (acc: any, item: any) => ({
        totalIn: acc.totalIn + item.totalIn,
        totalOut: acc.totalOut + item.totalOut,
      }),
      { totalIn: 0, totalOut: 0 },
    );

    res.json({
      period: {
        year: parseInt(year as string),
        month: parseInt(month as string),
      },
      totals,
      breakdown,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/category-spending
 * Get spending by category over time
 */
analyticsRouter.get(
  "/category-spending",
  async (req: Request, res: Response) => {
    try {
      const { userId, dateFrom, dateTo, categoryId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const where: any = {
        userId: userId as string,
      };

      if (dateFrom && dateTo) {
        where.date = {
          gte: new Date(dateFrom as string),
          lte: new Date(dateTo as string),
        };
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      const transactions = await prisma.transaction.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: {
          date: "asc",
        },
      });

      res.json({ transactions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);
