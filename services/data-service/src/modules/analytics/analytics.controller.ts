import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";

export const analyticsRouter = Router();

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
