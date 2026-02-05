import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  ImportTransactionInput,
  TransactionLinkage,
} from "../duplicates/duplicate-detector";

export class TransactionRepository {
  private static buildWhere(
    userId: string,
    filters?: {
      dateFrom?: Date;
      dateTo?: Date;
      categoryIds?: string[];
      search?: string;
      transactionType?: "income" | "expense";
      minAmount?: number;
      maxAmount?: number;
      accountIdentifier?: string;
    },
    excludeIds?: string[],
    ids?: string[],
  ) {
    const where: Prisma.TransactionWhereInput = { userId };

    if (ids && ids.length > 0) {
      where.id = { in: ids };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }

    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      where.categoryId = { in: filters.categoryIds };
    }

    if (filters?.accountIdentifier) {
      where.accountIdentifier = filters.accountIdentifier;
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

    if (filters?.minAmount !== undefined || filters?.maxAmount !== undefined) {
      where.OR = where.OR || [];
      if (filters.minAmount !== undefined && filters.maxAmount !== undefined) {
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
        where.OR.push(
          { amountIn: { gte: filters.minAmount } },
          { amountOut: { gte: filters.minAmount } },
        );
      } else if (filters.maxAmount !== undefined) {
        where.OR.push(
          { amountIn: { lte: filters.maxAmount } },
          { amountOut: { lte: filters.maxAmount } },
        );
      }
    }

    if (excludeIds && excludeIds.length > 0) {
      where.NOT = { id: { in: excludeIds } };
    }

    return where;
  }
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
        accountIdentifier: t.accountIdentifier,
        source: t.source,
        metadata: t.metadata
          ? (t.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
        linkage: t.linkage
          ? (t.linkage as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
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
    const where = TransactionRepository.buildWhere(userId, filters);

    const orderBy =
      filters?.dateOrder === "asc"
        ? { date: "asc" as const }
        : { date: "desc" as const };

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

  static async findManyByIds(userId: string, ids: string[]) {
    const where = TransactionRepository.buildWhere(
      userId,
      undefined,
      undefined,
      ids,
    );
    return prisma.transaction.findMany({
      where,
      include: {
        category: true,
        importBatch: true,
      },
      orderBy: { date: "desc" },
    });
  }

  static async findManyByFilter(
    userId: string,
    filters?: {
      dateFrom?: Date;
      dateTo?: Date;
      categoryIds?: string[];
      search?: string;
      transactionType?: "income" | "expense";
      minAmount?: number;
      maxAmount?: number;
      dateOrder?: "asc" | "desc";
      accountIdentifier?: string;
    },
    excludeIds?: string[],
  ) {
    const where = TransactionRepository.buildWhere(userId, filters, excludeIds);
    const orderBy =
      filters?.dateOrder === "asc"
        ? { date: "asc" as const }
        : { date: "desc" as const };
    return prisma.transaction.findMany({
      where,
      include: {
        category: true,
        importBatch: true,
      },
      orderBy,
    });
  }

  static async updateManyByIds(
    userId: string,
    ids: string[],
    updates: Partial<ImportTransactionInput>,
  ) {
    const where = TransactionRepository.buildWhere(
      userId,
      undefined,
      undefined,
      ids,
    );
    return prisma.transaction.updateMany({
      where,
      data: {
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.label !== undefined && { label: updates.label }),
        ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
        ...(updates.amountIn !== undefined && { amountIn: updates.amountIn }),
        ...(updates.amountOut !== undefined && { amountOut: updates.amountOut }),
        ...(updates.balance !== undefined && { balance: updates.balance }),
        ...(updates.date !== undefined && { date: updates.date }),
        ...(updates.accountIdentifier !== undefined && { accountIdentifier: updates.accountIdentifier }),
      },
    });
  }

  static async updateManyByFilter(
    userId: string,
    filters: {
      dateFrom?: Date;
      dateTo?: Date;
      categoryIds?: string[];
      search?: string;
      transactionType?: "income" | "expense";
      minAmount?: number;
      maxAmount?: number;
      accountIdentifier?: string;
    },
    excludeIds: string[] | undefined,
    updates: Partial<ImportTransactionInput>,
  ) {
    const where = TransactionRepository.buildWhere(userId, filters, excludeIds);
    return prisma.transaction.updateMany({
      where,
      data: {
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.label !== undefined && { label: updates.label }),
        ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
        ...(updates.amountIn !== undefined && { amountIn: updates.amountIn }),
        ...(updates.amountOut !== undefined && { amountOut: updates.amountOut }),
        ...(updates.balance !== undefined && { balance: updates.balance }),
        ...(updates.date !== undefined && { date: updates.date }),
        ...(updates.accountIdentifier !== undefined && { accountIdentifier: updates.accountIdentifier }),
      },
    });
  }

  static async deleteManyByFilter(
    userId: string,
    filters: {
      dateFrom?: Date;
      dateTo?: Date;
      categoryIds?: string[];
      search?: string;
      transactionType?: "income" | "expense";
      minAmount?: number;
      maxAmount?: number;
      accountIdentifier?: string;
    },
    excludeIds?: string[],
  ) {
    const where = TransactionRepository.buildWhere(userId, filters, excludeIds);
    return prisma.transaction.deleteMany({
      where,
    });
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

  /**
   * Search transactions for reimbursement linking
   */
  static async searchForReimbursement(
    userId: string,
    query: string,
    limit: number = 20,
  ) {
    return prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { description: { contains: query, mode: "insensitive" } },
          { label: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        category: true,
      },
      take: limit,
      orderBy: { date: "desc" },
    });
  }

  /**
   * Update linkage for a transaction
   */
  static async updateLinkage(
    id: string,
    userId: string,
    linkage: TransactionLinkage | Prisma.InputJsonValue | null,
  ) {
    const linkageData =
      linkage === null
        ? Prisma.DbNull
        : (linkage as Prisma.InputJsonValue);
    return prisma.transaction.update({
      where: { id, userId },
      data: { linkage: linkageData },
      include: { category: true },
    });
  }

  /**
   * Update linkage and category for a transaction
   */
  static async updateLinkageAndCategory(
    id: string,
    userId: string,
    linkage: TransactionLinkage | Prisma.InputJsonValue | null,
    categoryId: string,
  ) {
    const linkageData =
      linkage === null
        ? Prisma.DbNull
        : (linkage as Prisma.InputJsonValue);
    return prisma.transaction.update({
      where: { id, userId },
      data: { linkage: linkageData, categoryId },
      include: { category: true },
    });
  }

  /**
   * Get linked transactions by IDs
   */
  static async getLinkedTransactions(userId: string, ids: string[]) {
    return prisma.transaction.findMany({
      where: {
        userId,
        id: { in: ids },
      },
      include: {
        category: true,
      },
    });
  }
}
