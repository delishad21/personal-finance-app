import prisma from "../../lib/prisma";
import { ImportTransactionInput } from "../duplicates/duplicate-detector";

export class TransactionRepository {
  /**
   * Create multiple transactions in a single batch
   */
  static async createMany(
    userId: string,
    transactions: ImportTransactionInput[],
    importBatchId?: string,
  ) {
    return prisma.transaction.createMany({
      data: transactions.map((t) => ({
        userId,
        date: t.date,
        description: t.description,
        label: t.label,
        categoryId: t.categoryId,
        amountIn: t.amountIn,
        amountOut: t.amountOut,
        balance: t.balance,
        accountNumber: t.accountNumber,
        source: t.source,
        metadata: t.metadata,
        importBatchId,
      })),
    });
  }

  /**
   * Get transactions with filters
   */
  static async findMany(
    userId: string,
    filters?: {
      dateFrom?: Date;
      dateTo?: Date;
      categoryIds?: string[];
      search?: string;
      transactionType?: "income" | "expense";
      dateOrder?: "asc" | "desc";
      minAmount?: number;
      maxAmount?: number;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { userId };

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }

    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      where.categoryId = { in: filters.categoryIds };
    }

    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search, mode: "insensitive" } },
        { label: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters?.transactionType) {
      if (filters.transactionType === "income") {
        where.amountIn = { not: null };
      } else if (filters.transactionType === "expense") {
        where.amountOut = { not: null };
      }
    }

    // Handle amount filtering - check both amountIn and amountOut
    if (filters?.minAmount !== undefined || filters?.maxAmount !== undefined) {
      const amountConditions: any[] = [];

      if (filters.minAmount !== undefined) {
        amountConditions.push(
          { amountIn: { gte: filters.minAmount } },
          { amountOut: { gte: filters.minAmount } },
        );
      }

      if (filters.maxAmount !== undefined) {
        amountConditions.push(
          { amountIn: { lte: filters.maxAmount } },
          { amountOut: { lte: filters.maxAmount } },
        );
      }

      where.OR = where.OR || [];
      if (filters.minAmount !== undefined && filters.maxAmount !== undefined) {
        // Both min and max: amount must be in range
        where.OR.push(
          {
            AND: [
              { amountIn: { gte: filters.minAmount, lte: filters.maxAmount } },
            ],
          },
          {
            AND: [
              { amountOut: { gte: filters.minAmount, lte: filters.maxAmount } },
            ],
          },
        );
      } else if (filters.minAmount !== undefined) {
        // Only min
        where.OR.push(
          { amountIn: { gte: filters.minAmount } },
          { amountOut: { gte: filters.minAmount } },
        );
      } else if (filters.maxAmount !== undefined) {
        // Only max
        where.OR.push(
          { amountIn: { lte: filters.maxAmount } },
          { amountOut: { lte: filters.maxAmount } },
        );
      }
    }

    const orderBy =
      filters?.dateOrder === "asc" ? { date: "asc" } : { date: "desc" };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: true,
          importBatch: true,
        },
        orderBy,
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  static async getYears(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      select: { date: true },
    });

    const years = Array.from(
      new Set(transactions.map((t) => t.date.getFullYear())),
    ).sort((a, b) => b - a);

    return years;
  }

  /**
   * Get a single transaction by ID
   */
  static async findById(id: string, userId: string) {
    return prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        category: true,
        importBatch: true,
      },
    });
  }

  /**
   * Update a transaction
   */
  static async update(
    id: string,
    userId: string,
    data: Partial<ImportTransactionInput>,
  ) {
    return prisma.transaction.update({
      where: { id, userId },
      data: {
        description: data.description,
        label: data.label,
        categoryId: data.categoryId,
        amountIn: data.amountIn,
        amountOut: data.amountOut,
        balance: data.balance,
        date: data.date,
      },
    });
  }

  /**
   * Delete a transaction
   */
  static async delete(id: string, userId: string) {
    return prisma.transaction.delete({
      where: { id, userId },
    });
  }

  /**
   * Delete multiple transactions
   */
  static async deleteMany(ids: string[], userId: string) {
    return prisma.transaction.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });
  }
}
