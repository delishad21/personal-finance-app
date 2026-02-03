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
      categoryId?: string;
      search?: string;
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

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search, mode: "insensitive" } },
        { label: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: true,
          importBatch: true,
        },
        orderBy: { date: "desc" },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
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
