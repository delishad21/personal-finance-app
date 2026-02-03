import { TransactionRepository } from "./transactions.repository";
import {
  DuplicateDetector,
  ImportTransactionInput,
  DuplicateMatch,
} from "../duplicates/duplicate-detector";
import prisma from "../../lib/prisma";

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

      // Filter transactions by selected indices
      const selectedTransactions = transactions.filter((_, index) =>
        selectedIndices.includes(index),
      );

      // Import selected transactions
      const result = await TransactionRepository.createMany(
        userId,
        selectedTransactions,
        importBatchId,
      );

      return {
        success: true,
        importedCount: result.count,
        batchId: importBatchId,
      };
    } catch (error: any) {
      console.error("Error committing import:", error);
      return {
        success: false,
        error: error.message,
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
      categoryId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return TransactionRepository.findMany(userId, filters);
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
}
