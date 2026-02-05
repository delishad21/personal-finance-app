import { TransactionRepository } from "./transactions.repository";
import {
  DuplicateDetector,
  ImportTransactionInput,
  DuplicateMatch,
  TransactionLinkage,
} from "../duplicates/duplicate-detector";
import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";

// Reserved category names and colors
const RESERVED_CATEGORIES = {
  INTERNAL: { name: "Internal", color: "#9ca3af", icon: "arrow-left-right" },
  REIMBURSEMENT: { name: "Reimbursement", color: "#22c55e", icon: "receipt" },
  UNCATEGORIZED: { name: "Uncategorized", color: "#9ca3af", icon: "label" },
} as const;

export interface ImportResult {
  success: boolean;
  importedCount?: number;
  duplicatesDetected?: Map<number, DuplicateMatch[]>;
  batchId?: string;
  error?: string;
}

export class TransactionService {
  /**
   * Import transactions with duplicate detection
   * Returns duplicates for user review without committing
   */
  static async checkImport(
    userId: string,
    transactions: ImportTransactionInput[],
  ): Promise<{
    duplicates: Array<{ index: number; matches: DuplicateMatch[] }>;
    cleanCount: number;
  }> {
    const duplicatesMap = await DuplicateDetector.checkBulkDuplicates(
      userId,
      transactions,
    );

    const duplicates = Array.from(duplicatesMap.entries()).map(
      ([index, matches]) => ({
        index,
        matches,
      }),
    );

    return {
      duplicates,
      cleanCount: transactions.length - duplicates.length,
    };
  }

  /**
   * Ensure reserved categories exist for user
   */
  static async ensureReservedCategories(userId: string) {
    const [uncategorized, internal, reimbursement] = await Promise.all([
      prisma.category.upsert({
        where: { userId_name: { userId, name: RESERVED_CATEGORIES.UNCATEGORIZED.name } },
        update: {},
        create: {
          userId,
          ...RESERVED_CATEGORIES.UNCATEGORIZED,
          isDefault: true,
        },
      }),
      prisma.category.upsert({
        where: { userId_name: { userId, name: RESERVED_CATEGORIES.INTERNAL.name } },
        update: {},
        create: {
          userId,
          ...RESERVED_CATEGORIES.INTERNAL,
          isDefault: false,
        },
      }),
      prisma.category.upsert({
        where: { userId_name: { userId, name: RESERVED_CATEGORIES.REIMBURSEMENT.name } },
        update: {},
        create: {
          userId,
          ...RESERVED_CATEGORIES.REIMBURSEMENT,
          isDefault: false,
        },
      }),
    ]);

    return { uncategorized, internal, reimbursement };
  }

  /**
   * Commit selected transactions to database
   * Only imports transactions at specified indices
   */
  static async commitImport(
    userId: string,
    transactions: ImportTransactionInput[],
    selectedIndices: number[],
    batchInfo?: {
      filename: string;
      fileType: string;
      parserId: string;
    },
  ): Promise<ImportResult> {
    try {
      // Ensure reserved categories exist
      const { uncategorized, internal, reimbursement } =
        await this.ensureReservedCategories(userId);

      let importBatchId: string | undefined;

      // Create import batch if info provided
      if (batchInfo) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

        const batch = await prisma.importBatch.create({
          data: {
            userId,
            filename: batchInfo.filename,
            fileType: batchInfo.fileType,
            parserId: batchInfo.parserId,
            status: "COMMITTED",
            committedAt: new Date(),
            expiresAt,
          },
        });

        importBatchId = batch.id;
      }

      // Build index mapping for resolving batch indices later
      const indexToNewIndex = new Map<number, number>();
      let newIndex = 0;
      for (const originalIndex of selectedIndices.sort((a, b) => a - b)) {
        indexToNewIndex.set(originalIndex, newIndex++);
      }

      // Filter transactions by selected indices and assign categories based on linkage
      const selectedTransactions = transactions
        .filter((_, index) => selectedIndices.includes(index))
        .map((transaction) => {
          const linkage = transaction.linkage as TransactionLinkage | null;
          let categoryId = transaction.categoryId;

          // Auto-assign category based on linkage type
          if (linkage?.type === "internal") {
            categoryId = internal.id;
          } else if (linkage?.type === "reimbursement") {
            categoryId = reimbursement.id;
          } else if (!categoryId || categoryId.trim().length === 0) {
            categoryId = uncategorized.id;
          }

          // Clean up _pendingBatchIndices before storing (will resolve after insert)
          const cleanLinkage = linkage
            ? { ...linkage, _pendingBatchIndices: undefined }
            : null;

          return {
            ...transaction,
            categoryId,
            linkage: cleanLinkage,
          };
        });

      // Import selected transactions
      const result = await TransactionRepository.createMany(
        userId,
        selectedTransactions,
        importBatchId,
      );

      // Get the created transactions to resolve batch indices
      if (importBatchId) {
        const createdTransactions = await prisma.transaction.findMany({
          where: { importBatchId },
          orderBy: { createdAt: "asc" },
        });

        // Resolve pending batch indices to actual IDs
        for (let i = 0; i < selectedTransactions.length; i++) {
          const transaction = selectedTransactions[i];
          const linkage = transaction.linkage as TransactionLinkage | null;
          const originalLinkage = transactions[selectedIndices[i]]
            .linkage as TransactionLinkage | null;

          if (
            originalLinkage?.type === "reimbursement" &&
            originalLinkage._pendingBatchIndices?.length
          ) {
            // Resolve batch indices to actual IDs
            const reimburseIds: string[] = linkage?.reimburses || [];

            for (const batchIndex of originalLinkage._pendingBatchIndices) {
              const targetNewIndex = indexToNewIndex.get(batchIndex);
              if (targetNewIndex !== undefined && createdTransactions[targetNewIndex]) {
                reimburseIds.push(createdTransactions[targetNewIndex].id);
              }
            }

            if (reimburseIds.length > 0) {
              // Update the reimbursement transaction with resolved IDs
              await prisma.transaction.update({
                where: { id: createdTransactions[i].id },
                data: {
                  linkage: {
                    ...linkage,
                    reimburses: reimburseIds,
                  },
                },
              });

              // Update the reimbursed transactions with backlinks
              for (const reimbursedId of reimburseIds) {
                const reimbursed = await prisma.transaction.findUnique({
                  where: { id: reimbursedId },
                  select: { linkage: true },
                });

                const existingLinkage = reimbursed?.linkage as TransactionLinkage | null;
                const existingReimbursedBy = existingLinkage?.reimbursedBy || [];

                await prisma.transaction.update({
                  where: { id: reimbursedId },
                  data: {
                    linkage: {
                      type: "reimbursed",
                      reimbursedBy: [...existingReimbursedBy, createdTransactions[i].id],
                    },
                  },
                });
              }
            }
          }
        }
      }

      return {
        success: true,
        importedCount: result.count,
        batchId: importBatchId,
      };
    } catch (error: unknown) {
      console.error("Error committing import:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get transactions with filters
   */
  static async getTransactions(
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
      accountIdentifier?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return TransactionRepository.findMany(userId, filters);
  }

  static async getTransactionYears(userId: string) {
    return TransactionRepository.getYears(userId);
  }

  /**
   * Get single transaction
   */
  static async getTransaction(id: string, userId: string) {
    return TransactionRepository.findById(id, userId);
  }

  /**
   * Update transaction
   */
  static async updateTransaction(
    id: string,
    userId: string,
    data: Partial<ImportTransactionInput>,
  ) {
    return TransactionRepository.update(id, userId, data);
  }

  /**
   * Delete transaction
   */
  static async deleteTransaction(id: string, userId: string) {
    return TransactionRepository.delete(id, userId);
  }

  /**
   * Delete multiple transactions
   */
  static async deleteTransactions(ids: string[], userId: string) {
    return TransactionRepository.deleteMany(ids, userId);
  }

  static async bulkUpdateByIds(
    userId: string,
    ids: string[],
    updates: Partial<ImportTransactionInput>,
  ) {
    return TransactionRepository.updateManyByIds(userId, ids, updates);
  }

  static async bulkUpdateByFilter(
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
    return TransactionRepository.updateManyByFilter(
      userId,
      filters,
      excludeIds,
      updates,
    );
  }

  static async bulkDeleteByFilter(
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
    return TransactionRepository.deleteManyByFilter(
      userId,
      filters,
      excludeIds,
    );
  }

  static async exportByIds(userId: string, ids: string[]) {
    return TransactionRepository.findManyByIds(userId, ids);
  }

  static async exportByFilter(
    userId: string,
    filters: {
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
    return TransactionRepository.findManyByFilter(userId, filters, excludeIds);
  }

  /**
   * Mark a transaction as internal
   */
  static async markAsInternal(
    id: string,
    userId: string,
    autoDetected: boolean = false,
    detectionReason?: string,
  ) {
    const { internal } = await this.ensureReservedCategories(userId);

    const linkage: TransactionLinkage = {
      type: "internal",
      autoDetected,
      detectionReason,
    };

    return TransactionRepository.updateLinkageAndCategory(
      id,
      userId,
      linkage,
      internal.id,
    );
  }

  /**
   * Create reimbursement link between transactions
   */
  static async createReimbursementLink(
    reimbursementId: string,
    reimbursedIds: string[],
    userId: string,
  ) {
    const { reimbursement } = await this.ensureReservedCategories(userId);

    const existing = await prisma.transaction.findUnique({
      where: { id: reimbursementId },
      select: { linkage: true },
    });

    const existingLinkage = existing?.linkage as TransactionLinkage | null;
    if (existingLinkage?.type === "internal") {
      throw new Error("Internal transactions cannot be marked as reimbursements");
    }

    // Update the reimbursing transaction
    const linkage: TransactionLinkage = {
      type: "reimbursement",
      reimburses: reimbursedIds,
    };

    await TransactionRepository.updateLinkageAndCategory(
      reimbursementId,
      userId,
      linkage,
      reimbursement.id,
    );

    // Update each reimbursed transaction with backlink
    for (const reimbursedId of reimbursedIds) {
      const existing = await prisma.transaction.findUnique({
        where: { id: reimbursedId },
        select: { linkage: true },
      });

      const existingLinkage = existing?.linkage as TransactionLinkage | null;
      const existingReimbursedBy = existingLinkage?.reimbursedBy || [];

      await TransactionRepository.updateLinkage(reimbursedId, userId, {
        type: "reimbursed",
        reimbursedBy: [...existingReimbursedBy, reimbursementId],
      });
    }

    return { success: true };
  }

  /**
   * Clear linkage from a transaction
   */
  static async clearLinkage(id: string, userId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: { linkage: true },
    });

    const linkage = transaction?.linkage as TransactionLinkage | null;

    // If this was a reimbursement, clean up backlinks
    if (linkage?.type === "reimbursement" && linkage.reimburses) {
      for (const reimbursedId of linkage.reimburses) {
        const reimbursed = await prisma.transaction.findUnique({
          where: { id: reimbursedId },
          select: { linkage: true },
        });

        const reimbursedLinkage = reimbursed?.linkage as TransactionLinkage | null;
        const updatedReimbursedBy = (reimbursedLinkage?.reimbursedBy || []).filter(
          (rid) => rid !== id,
        );

        if (updatedReimbursedBy.length > 0) {
          await TransactionRepository.updateLinkage(reimbursedId, userId, {
            type: "reimbursed",
            reimbursedBy: updatedReimbursedBy,
          });
        } else {
          // No more reimbursements, clear linkage entirely
          await TransactionRepository.updateLinkage(reimbursedId, userId, null);
        }
      }
    }

    // Clear the transaction's linkage and category
    return prisma.transaction.update({
      where: { id, userId },
      data: { linkage: Prisma.DbNull, categoryId: null },
      include: { category: true },
    });
  }

  /**
   * Get linked transactions for display
   */
  static async getLinkedTransactions(id: string, userId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: { linkage: true },
    });

    const linkage = transaction?.linkage as TransactionLinkage | null;
    if (!linkage) return { reimburses: [], reimbursedBy: [] };

    const [reimburses, reimbursedBy] = await Promise.all([
      linkage.reimburses?.length
        ? TransactionRepository.getLinkedTransactions(userId, linkage.reimburses)
        : [],
      linkage.reimbursedBy?.length
        ? TransactionRepository.getLinkedTransactions(userId, linkage.reimbursedBy)
        : [],
    ]);

    return { reimburses, reimbursedBy };
  }

  /**
   * Search transactions for reimbursement linking
   */
  static async searchForReimbursement(
    userId: string,
    query: string,
    limit: number = 20,
  ) {
    return TransactionRepository.searchForReimbursement(userId, query, limit);
  }
}
