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

export interface ImportRulePayload {
  name: string;
  parserId?: string | null;
  matchType?: "always" | "description_contains";
  matchValue?: string | null;
  caseSensitive?: boolean;
  enabled?: boolean;
  setLabel?: string | null;
  setCategoryName?: string | null;
  markInternal?: boolean;
  sortOrder?: number;
}

export class TransactionService {
  private static readonly PAYLAH_INTERNAL_RULE_NAMES = [
    "PayLah top-up from account is Internal",
    "DBS/POSB top-up to PayLah is Internal",
    "PayLah send back to bank is Internal",
    "DBS/POSB receive back from PayLah is Internal",
  ] as const;

  private static readonly DBS_PAYLAH_INTERNAL_PATTERNS = [
    "TOP-UP TO PAYLAH!",
    "SEND BACK FROM PAYLAH!",
  ] as const;

  private static readonly DEFAULT_IMPORT_RULES: ImportRulePayload[] = [
    {
      name: "PayLah top-up from account is Internal",
      parserId: "dbs_paylah_statement",
      matchType: "description_contains",
      matchValue: "TOP UP WALLET FROM MY ACCOUNT",
      caseSensitive: false,
      enabled: false,
      setLabel: null,
      setCategoryName: null,
      markInternal: true,
      sortOrder: 10,
    },
    {
      name: "DBS/POSB top-up to PayLah is Internal",
      parserId: "dbs_posb_consolidated",
      matchType: "description_contains",
      matchValue: "TOP-UP TO PAYLAH!",
      caseSensitive: false,
      enabled: false,
      setLabel: null,
      setCategoryName: null,
      markInternal: true,
      sortOrder: 20,
    },
    {
      name: "PayLah send back to bank is Internal",
      parserId: "dbs_paylah_statement",
      matchType: "description_contains",
      matchValue: "SEND MONEY TO MY ACCOUNT",
      caseSensitive: false,
      enabled: false,
      setLabel: null,
      setCategoryName: null,
      markInternal: true,
      sortOrder: 30,
    },
    {
      name: "DBS/POSB receive back from PayLah is Internal",
      parserId: "dbs_posb_consolidated",
      matchType: "description_contains",
      matchValue: "SEND BACK FROM PAYLAH!",
      caseSensitive: false,
      enabled: false,
      setLabel: null,
      setCategoryName: null,
      markInternal: true,
      sortOrder: 40,
    },
    {
      name: "BUS/MRT transactions are Transportation",
      parserId: null,
      matchType: "description_contains",
      matchValue: "BUS/MRT",
      caseSensitive: false,
      enabled: true,
      setLabel: null,
      setCategoryName: "Transportation",
      markInternal: false,
      sortOrder: 50,
    },
  ];

  private static normalizeImportRulePayload(payload: ImportRulePayload) {
    return {
      name: payload.name.trim(),
      parserId: payload.parserId?.trim() || null,
      matchType: payload.matchType || "description_contains",
      matchValue: payload.matchValue?.trim() || null,
      caseSensitive: payload.caseSensitive ?? false,
      enabled: payload.enabled ?? true,
      setLabel: payload.setLabel?.trim() || null,
      setCategoryName: payload.setCategoryName?.trim() || null,
      markInternal: payload.markInternal ?? false,
      sortOrder: payload.sortOrder ?? 0,
    };
  }

  private static ruleMatches(
    rule: {
      matchType: string;
      matchValue: string | null;
      caseSensitive: boolean;
    },
    tx: { description?: string | null },
  ) {
    const description = tx.description || "";
    if (rule.matchType === "always") {
      return true;
    }
    if (rule.matchType === "description_contains") {
      const needle = rule.matchValue || "";
      if (!needle) return false;
      if (rule.caseSensitive) {
        return description.includes(needle);
      }
      return description.toLowerCase().includes(needle.toLowerCase());
    }
    return false;
  }

  private static async applyImportRules(
    userId: string,
    parserId: string | undefined,
    transactions: ImportTransactionInput[],
  ): Promise<ImportTransactionInput[]> {
    if (transactions.length === 0) return transactions;

    const rules = await prisma.importRule.findMany({
      where: {
        userId,
        enabled: true,
        OR: [{ parserId: null }, { parserId: parserId || null }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    if (rules.length === 0) return transactions;

    const categoryNames = Array.from(
      new Set(
        rules
          .map((rule) => rule.setCategoryName?.trim())
          .filter((value): value is string => !!value),
      ),
    );
    const categoryMap = new Map<string, string>();
    if (categoryNames.length > 0) {
      const categories = await prisma.category.findMany({
        where: {
          userId,
          OR: categoryNames.map((name) => ({
            name: { equals: name, mode: "insensitive" },
          })),
        },
        select: { id: true, name: true },
      });
      categories.forEach((category) => {
        categoryMap.set(category.name.toLowerCase(), category.id);
      });
    }

    return transactions.map((originalTx) => {
      const tx = { ...originalTx };
      for (const rule of rules) {
        if (!this.ruleMatches(rule, tx)) continue;

        const hasExplicitLinkage = !!tx.linkage;
        const hasExplicitCategory = !!tx.categoryId;
        const hasExplicitLabel = !!tx.label && tx.label.trim().length > 0;

        if (rule.markInternal && !hasExplicitLinkage) {
          tx.linkage = {
            type: "internal",
            autoDetected: true,
            detectionReason: `Matched import rule: ${rule.name}`,
          };
        }

        if (rule.setLabel && !hasExplicitLabel) {
          tx.label = rule.setLabel;
        }

        if (
          rule.setCategoryName &&
          !hasExplicitCategory &&
          (!tx.linkage || tx.linkage.type === "reimbursed")
        ) {
          const categoryId = categoryMap.get(rule.setCategoryName.toLowerCase());
          if (categoryId) {
            tx.categoryId = categoryId;
          }
        }
      }
      return tx;
    });
  }

  private static sanitizeLinkageForTransaction(
    transactionId: string,
    linkage: TransactionLinkage | null,
    context?: {
      linkageByTransactionId: Map<string, TransactionLinkage | null>;
      targetId?: string;
    },
  ): TransactionLinkage | null {
    if (!linkage) return null;

    if (linkage.type === "reimbursed") {
      const linkageByTransactionId = context?.linkageByTransactionId;
      const targetId = context?.targetId || transactionId;
      const isValidReimburser = (reimburserId: string) => {
        if (!linkageByTransactionId) return true;
        const reimburserLinkage = linkageByTransactionId.get(reimburserId);
        if (!reimburserLinkage || reimburserLinkage.type !== "reimbursement") {
          return false;
        }
        const reimbursesSet = new Set<string>();
        (reimburserLinkage.reimbursesAllocations || []).forEach((item) => {
          if (typeof item.transactionId === "string") {
            reimbursesSet.add(item.transactionId);
          }
        });
        return reimbursesSet.has(targetId);
      };

      const reimbursedByAllocations = (linkage.reimbursedByAllocations || [])
        .filter(
          (item) =>
            item &&
            typeof item.transactionId === "string" &&
            item.transactionId.length > 0 &&
            item.transactionId !== transactionId &&
            Number(item.amount || 0) > 0 &&
            isValidReimburser(item.transactionId),
        )
        .map((item) => ({
          transactionId: item.transactionId,
          amount: Number(item.amount),
        }));

      if (reimbursedByAllocations.length === 0) {
        return null;
      }

      return {
        type: "reimbursed",
        reimbursedByAllocations,
        autoDetected: linkage.autoDetected,
        detectionReason: linkage.detectionReason,
      };
    }

    if (linkage.type === "reimbursement") {
      const linkageByTransactionId = context?.linkageByTransactionId;
      const sourceId = transactionId;
      const isValidTarget = (targetId: string) => {
        if (!linkageByTransactionId) return true;
        const targetLinkage = linkageByTransactionId.get(targetId);
        if (!targetLinkage || targetLinkage.type !== "reimbursed") {
          return false;
        }
        const reimbursedBySet = new Set<string>();
        (targetLinkage.reimbursedByAllocations || []).forEach((item) => {
          if (typeof item.transactionId === "string") {
            reimbursedBySet.add(item.transactionId);
          }
        });
        return reimbursedBySet.has(sourceId);
      };

      const reimbursesAllocations = (linkage.reimbursesAllocations || [])
        .filter(
          (item) =>
            item &&
            ((typeof item.transactionId === "string" &&
              item.transactionId.length > 0 &&
              item.transactionId !== transactionId &&
              isValidTarget(item.transactionId)) ||
              typeof item.pendingBatchIndex === "number") &&
            Number(item.amount || 0) >= 0,
        )
        .map((item) => ({
          transactionId: item.transactionId,
          pendingBatchIndex: item.pendingBatchIndex,
          amount: Number(item.amount),
        }));

      return {
        type: "reimbursement",
        reimbursesAllocations,
        leftoverAmount:
          linkage.leftoverAmount !== undefined
            ? Number(linkage.leftoverAmount)
            : undefined,
        leftoverCategoryId: linkage.leftoverCategoryId ?? null,
        autoDetected: linkage.autoDetected,
        detectionReason: linkage.detectionReason,
      };
    }

    return linkage;
  }

  private static getAbsoluteTransactionAmount(input: {
    amountIn?: number | null;
    amountOut?: number | null;
  }) {
    const amountIn = input.amountIn ?? null;
    const amountOut = input.amountOut ?? null;
    if (amountOut !== null && amountOut !== undefined && amountOut > 0) return amountOut;
    if (amountIn !== null && amountIn !== undefined && amountIn > 0) return amountIn;
    return 0;
  }

  private static normalizeReimbursementAllocations(
    linkage: TransactionLinkage | null | undefined,
  ) {
    if (!linkage || linkage.type !== "reimbursement") return [];

    return (linkage.reimbursesAllocations || [])
      .map((item) => ({
        transactionId: item.transactionId,
        pendingBatchIndex: item.pendingBatchIndex,
        amount: Number(item.amount || 0),
      }))
      .filter(
        (item) =>
          item.amount > 0 &&
          (typeof item.transactionId === "string" ||
            typeof item.pendingBatchIndex === "number"),
      );
  }

  private static async removeReimbursementBacklinks(
    userId: string,
    reimbursementId: string,
    reimbursedIds: string[],
  ) {
    for (const reimbursedId of reimbursedIds) {
      const reimbursed = await prisma.transaction.findUnique({
        where: { id: reimbursedId },
        select: { linkage: true },
      });

      const reimbursedLinkage = reimbursed?.linkage as TransactionLinkage | null;
      if (!reimbursedLinkage) continue;

      const updatedReimbursedByAllocations = (
        reimbursedLinkage.reimbursedByAllocations || []
      ).filter((allocation) => allocation.transactionId !== reimbursementId);

      if (updatedReimbursedByAllocations.length > 0) {
        await TransactionRepository.updateLinkage(reimbursedId, userId, {
          ...reimbursedLinkage,
          type: "reimbursed",
          reimbursedByAllocations: updatedReimbursedByAllocations,
        });
      } else {
        await TransactionRepository.updateLinkage(reimbursedId, userId, null);
      }
    }
  }

  private static async applyReimbursementBacklinks(
    userId: string,
    reimbursementId: string,
    allocations: Array<{ transactionId: string; amount: number }>,
  ) {
    for (const allocation of allocations) {
      const capacity = await this.getTargetReimbursementCapacity(
        userId,
        allocation.transactionId,
        reimbursementId,
      );
      if (allocation.amount - capacity.remaining > 0.01) {
        throw new Error(
          `Allocation exceeds remaining reimbursable amount for transaction ${allocation.transactionId}`,
        );
      }

      const reimbursed = await prisma.transaction.findUnique({
        where: { id: allocation.transactionId },
        select: { linkage: true },
      });

      const existingLinkage = reimbursed?.linkage as TransactionLinkage | null;
      const existingReimbursedByAllocations =
        existingLinkage?.reimbursedByAllocations || [];

      const withoutCurrent = existingReimbursedByAllocations.filter(
        (item) => item.transactionId !== reimbursementId,
      );

      await TransactionRepository.updateLinkage(allocation.transactionId, userId, {
        ...existingLinkage,
        type: "reimbursed",
        reimbursedByAllocations: [
          ...withoutCurrent,
          { transactionId: reimbursementId, amount: allocation.amount },
        ],
      });
    }
  }

  private static async getTargetReimbursementCapacity(
    userId: string,
    targetTransactionId: string,
    currentReimbursementId?: string,
  ) {
    const target = await prisma.transaction.findFirst({
      where: { id: targetTransactionId, userId },
      select: {
        amountIn: true,
        amountOut: true,
        linkage: true,
      },
    });

    if (!target) {
      throw new Error("Reimbursed transaction not found");
    }

    const targetAmount = this.getAbsoluteTransactionAmount({
      amountIn: target.amountIn !== null ? Number(target.amountIn) : undefined,
      amountOut: target.amountOut !== null ? Number(target.amountOut) : undefined,
    });

    const targetLinkage = target.linkage as TransactionLinkage | null;
    const alreadyAllocated = (targetLinkage?.reimbursedByAllocations || [])
      .filter((item) => item.transactionId !== currentReimbursementId)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      targetAmount,
      alreadyAllocated,
      remaining: Number(Math.max(targetAmount - alreadyAllocated, 0).toFixed(2)),
    };
  }

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

  static async bootstrapDefaultImportRules(userId: string) {
    // Remove previously shipped incorrect defaults before re-seeding.
    await prisma.importRule.deleteMany({
      where: {
        userId,
        name: {
          in: [
            "PayLah statement transactions are Internal",
            "PayLah top-up transactions are Internal",
          ],
        },
      },
    });

    await Promise.all(
      this.DEFAULT_IMPORT_RULES.map((rule) => {
        const normalized = this.normalizeImportRulePayload(rule);
        return prisma.importRule.upsert({
          where: {
            userId_name: {
              userId,
              name: normalized.name,
            },
          },
          update: {},
          create: {
            userId,
            ...normalized,
          },
        });
      }),
    );
  }

  static async getPaylahInternalPreferenceState(userId: string) {
    const [settings, paylahRules] = await Promise.all([
      prisma.userSettings.findUnique({
        where: { userId },
        select: {
          paylahInternalPrompted: true,
          paylahAutoInternal: true,
        },
      }),
      prisma.importRule.findMany({
        where: {
          userId,
          name: { in: [...this.PAYLAH_INTERNAL_RULE_NAMES] },
        },
        select: {
          id: true,
          enabled: true,
        },
      }),
    ]);

    const hasEnabledRule = paylahRules.some((rule) => rule.enabled);
    const prompted = Boolean(settings?.paylahInternalPrompted || hasEnabledRule);
    const enabled = Boolean(settings?.paylahAutoInternal || hasEnabledRule);

    return {
      shouldPrompt: !prompted,
      enabled,
    };
  }

  private static async backfillDbsPaylahTransactionsAsInternal(userId: string) {
    const { internal } = await this.ensureReservedCategories(userId);

    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        importBatch: {
          is: { parserId: "dbs_posb_consolidated" },
        },
        OR: this.DBS_PAYLAH_INTERNAL_PATTERNS.map((pattern) => ({
          description: {
            contains: pattern,
            mode: "insensitive",
          },
        })),
      },
      select: {
        id: true,
        linkage: true,
      },
    });

    const eligibleIds = candidates
      .filter((transaction) => {
        const linkage = transaction.linkage as TransactionLinkage | null;
        return linkage?.type !== "reimbursement" && linkage?.type !== "reimbursed";
      })
      .map((transaction) => transaction.id);

    if (eligibleIds.length === 0) {
      return { updatedCount: 0 };
    }

    await prisma.transaction.updateMany({
      where: {
        userId,
        id: { in: eligibleIds },
      },
      data: {
        linkage: {
          type: "internal",
          autoDetected: true,
          detectionReason: "Enabled PayLah internal auto-marking",
        },
        categoryId: internal.id,
      },
    });

    return { updatedCount: eligibleIds.length };
  }

  static async setPaylahInternalPreference(userId: string, enabled: boolean) {
    await this.bootstrapDefaultImportRules(userId);

    await prisma.$transaction(async (tx) => {
      await tx.userSettings.upsert({
        where: { userId },
        update: {
          paylahInternalPrompted: true,
          paylahAutoInternal: enabled,
        },
        create: {
          userId,
          paylahInternalPrompted: true,
          paylahAutoInternal: enabled,
        },
      });

      await tx.importRule.updateMany({
        where: {
          userId,
          name: { in: [...this.PAYLAH_INTERNAL_RULE_NAMES] },
        },
        data: {
          enabled,
        },
      });
    });

    if (!enabled) {
      return {
        enabled,
        updatedCount: 0,
      };
    }

    const { updatedCount } =
      await this.backfillDbsPaylahTransactionsAsInternal(userId);

    return {
      enabled,
      updatedCount,
    };
  }

  static async getImportRules(userId: string) {
    return prisma.importRule.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  static async createImportRule(userId: string, payload: ImportRulePayload) {
    const normalized = this.normalizeImportRulePayload(payload);
    if (!normalized.name) {
      throw new Error("Rule name is required");
    }
    if (
      normalized.matchType === "description_contains" &&
      (!normalized.matchValue || normalized.matchValue.length === 0)
    ) {
      throw new Error("Match value is required for description contains rules");
    }
    return prisma.importRule.create({
      data: {
        userId,
        ...normalized,
      },
    });
  }

  static async updateImportRule(
    userId: string,
    ruleId: string,
    payload: Partial<ImportRulePayload>,
  ) {
    const existing = await prisma.importRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!existing) throw new Error("Import rule not found");

    const normalized = this.normalizeImportRulePayload({
      name: payload.name ?? existing.name,
      parserId:
        payload.parserId !== undefined ? payload.parserId : existing.parserId,
      matchType:
        (payload.matchType as "always" | "description_contains" | undefined) ??
        (existing.matchType as "always" | "description_contains"),
      matchValue:
        payload.matchValue !== undefined
          ? payload.matchValue
          : existing.matchValue,
      caseSensitive:
        payload.caseSensitive !== undefined
          ? payload.caseSensitive
          : existing.caseSensitive,
      enabled: payload.enabled !== undefined ? payload.enabled : existing.enabled,
      setLabel:
        payload.setLabel !== undefined ? payload.setLabel : existing.setLabel,
      setCategoryName:
        payload.setCategoryName !== undefined
          ? payload.setCategoryName
          : existing.setCategoryName,
      markInternal:
        payload.markInternal !== undefined
          ? payload.markInternal
          : existing.markInternal,
      sortOrder:
        payload.sortOrder !== undefined ? payload.sortOrder : existing.sortOrder,
    });

    if (!normalized.name) {
      throw new Error("Rule name is required");
    }
    if (
      normalized.matchType === "description_contains" &&
      (!normalized.matchValue || normalized.matchValue.length === 0)
    ) {
      throw new Error("Match value is required for description contains rules");
    }

    return prisma.importRule.update({
      where: { id: ruleId },
      data: normalized,
    });
  }

  static async deleteImportRule(userId: string, ruleId: string) {
    const existing = await prisma.importRule.findFirst({
      where: { id: ruleId, userId },
      select: { id: true },
    });
    if (!existing) throw new Error("Import rule not found");
    await prisma.importRule.delete({ where: { id: ruleId } });
    return { success: true };
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
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { currency: true },
      });
      const userBaseCurrency = (userSettings?.currency || "SGD").toUpperCase();

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

      const rawSelectedTransactions = transactions.filter((_, index) =>
        selectedIndices.includes(index),
      );
      const ruleAppliedTransactions = await this.applyImportRules(
        userId,
        batchInfo?.parserId,
        rawSelectedTransactions,
      );

      // Filter transactions by selected indices and assign categories based on linkage
      const selectedTransactions = ruleAppliedTransactions.map((transaction) => {
          const linkage = transaction.linkage as TransactionLinkage | null;
          let categoryId = transaction.categoryId;
          const amountIn =
            transaction.amountIn !== undefined ? Number(transaction.amountIn) : null;

          // Auto-assign category based on linkage type
          if (linkage?.type === "internal") {
            categoryId = internal.id;
          } else if (linkage?.type === "reimbursement") {
            if (!amountIn || amountIn <= 0) {
              throw new Error(
                "Only positive inflow transactions can be marked as reimbursement",
              );
            }
            categoryId = reimbursement.id;
          } else if (!categoryId || categoryId.trim().length === 0) {
            categoryId = uncategorized.id;
          }

          const cleanLinkage = linkage ? { ...linkage } : null;

          const resolvedCurrency = (
            transaction.currency ||
            transaction.metadata?.currency ||
            userBaseCurrency ||
            "SGD"
          )
            .toString()
            .trim()
            .toUpperCase();

          return {
            ...transaction,
            categoryId,
            currency: resolvedCurrency || "SGD",
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
            originalLinkage.reimbursesAllocations?.length
          ) {
            const baseLinkage = (linkage || {
              type: "reimbursement",
            }) as TransactionLinkage;
            const normalizedAllocations = this.normalizeReimbursementAllocations(
              originalLinkage,
            );

            const resolvedAllocations = normalizedAllocations
              .map((allocation) => {
                if (allocation.transactionId) return allocation;
                if (
                  !("pendingBatchIndex" in allocation) ||
                  typeof allocation.pendingBatchIndex !== "number"
                ) {
                  return null;
                }
                const targetNewIndex = indexToNewIndex.get(
                  allocation.pendingBatchIndex,
                );
                if (
                  targetNewIndex === undefined ||
                  !createdTransactions[targetNewIndex]
                ) {
                  return null;
                }
                return {
                  transactionId: createdTransactions[targetNewIndex].id,
                  amount: allocation.amount,
                };
              })
              .filter(
                (allocation): allocation is { transactionId: string; amount: number } =>
                  !!allocation?.transactionId,
              );

            await prisma.transaction.update({
              where: { id: createdTransactions[i].id },
              data: {
                linkage: {
                  type: "reimbursement",
                  reimbursesAllocations: resolvedAllocations,
                  leftoverAmount:
                    baseLinkage.leftoverAmount !== undefined
                      ? Number(baseLinkage.leftoverAmount)
                      : undefined,
                  leftoverCategoryId: baseLinkage.leftoverCategoryId ?? null,
                  autoDetected: baseLinkage.autoDetected,
                  detectionReason: baseLinkage.detectionReason,
                },
              },
            });

            await this.applyReimbursementBacklinks(
              userId,
              createdTransactions[i].id,
              resolvedAllocations.filter((item) => item.amount > 0),
            );
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
    const existing = await TransactionRepository.findById(id, userId);
    if (!existing) {
      throw new Error("Transaction not found");
    }

    const next: Partial<ImportTransactionInput> = { ...data };
    const linkage = data.linkage as TransactionLinkage | null | undefined;
    const existingLinkage = existing.linkage as TransactionLinkage | null;
    let normalizedAllocations: Array<{
      transactionId: string;
      amount: number;
    }> = [];

    if (linkage !== undefined) {
      if (linkage?.type === "internal") {
        const { internal } = await this.ensureReservedCategories(userId);
        next.categoryId = internal.id;
      } else if (linkage?.type === "reimbursement") {
        const amountIn =
          next.amountIn ??
          (existing.amountIn !== null ? Number(existing.amountIn) : null);
        if (!amountIn || amountIn <= 0) {
          throw new Error(
            "Only positive inflow transactions can be marked as reimbursement",
          );
        }
        normalizedAllocations = this.normalizeReimbursementAllocations(linkage)
          .map((allocation) =>
            typeof allocation.transactionId === "string"
              ? {
                  transactionId: allocation.transactionId,
                  amount: Number(allocation.amount || 0),
                }
              : null,
          )
          .filter(
            (allocation): allocation is { transactionId: string; amount: number } =>
              !!allocation,
          );
        const totalAllocated = normalizedAllocations.reduce(
          (sum, allocation) => sum + allocation.amount,
          0,
        );
        if (totalAllocated - amountIn > 0.01) {
          throw new Error("Total reimbursed amount cannot exceed reimbursement amount");
        }
        for (const allocation of normalizedAllocations) {
          if (allocation.transactionId === id) {
            throw new Error("A transaction cannot reimburse itself");
          }
          const target = await TransactionRepository.findById(
            allocation.transactionId,
            userId,
          );
          if (!target) {
            throw new Error("One or more reimbursed transactions were not found");
          }
          const capacity = await this.getTargetReimbursementCapacity(
            userId,
            allocation.transactionId,
            id,
          );
          if (allocation.amount - capacity.remaining > 0.01) {
            throw new Error("Reimbursed amount cannot exceed target transaction amount");
          }
        }
        const { reimbursement } = await this.ensureReservedCategories(userId);
        next.categoryId = reimbursement.id;
        next.linkage = {
          type: "reimbursement",
          reimbursesAllocations: normalizedAllocations,
          leftoverAmount: Number((amountIn - totalAllocated).toFixed(2)),
          leftoverCategoryId: linkage.leftoverCategoryId ?? null,
          autoDetected: linkage.autoDetected,
          detectionReason: linkage.detectionReason,
        };
      } else if (linkage === null) {
        const currentCategoryName = existing.category?.name ?? "";
        if (
          currentCategoryName === RESERVED_CATEGORIES.INTERNAL.name ||
          currentCategoryName === RESERVED_CATEGORIES.REIMBURSEMENT.name
        ) {
          next.categoryId = null;
        }
      }
    }

    const updated = await TransactionRepository.update(id, userId, next);

    const previousReimbursedIds =
      existingLinkage?.type === "reimbursement"
        ? Array.from(
            new Set(
              this.normalizeReimbursementAllocations(existingLinkage)
                .map((allocation) => allocation.transactionId || "")
                .filter(Boolean),
            ),
          )
        : [];
    if (previousReimbursedIds.length > 0) {
      await this.removeReimbursementBacklinks(userId, id, previousReimbursedIds);
    }
    if (
      linkage?.type === "reimbursement" &&
      normalizedAllocations.length > 0
    ) {
      await this.applyReimbursementBacklinks(
        userId,
        id,
        normalizedAllocations.filter((allocation) => allocation.amount > 0),
      );
    }

    return updated;
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
    reimbursedAllocations: Array<{ transactionId: string; amount: number }>,
    userId: string,
    leftoverCategoryId?: string | null,
  ) {
    const { reimbursement } = await this.ensureReservedCategories(userId);

    const reimbursingTransaction = await TransactionRepository.findById(
      reimbursementId,
      userId,
    );
    if (!reimbursingTransaction) {
      throw new Error("Transaction not found");
    }
    const amountIn = reimbursingTransaction.amountIn
      ? Number(reimbursingTransaction.amountIn)
      : null;
    if (!amountIn || amountIn <= 0) {
      throw new Error(
        "Only positive inflow transactions can be marked as reimbursement",
      );
    }

    const existing = await prisma.transaction.findUnique({
      where: { id: reimbursementId },
      select: { linkage: true },
    });

    const existingLinkage = existing?.linkage as TransactionLinkage | null;
    if (existingLinkage?.type === "internal") {
      throw new Error("Internal transactions cannot be marked as reimbursements");
    }

    const totalAllocated = reimbursedAllocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount || 0),
      0,
    );
    if (totalAllocated - amountIn > 0.01) {
      throw new Error("Total reimbursed amount cannot exceed reimbursement amount");
    }

    for (const allocation of reimbursedAllocations) {
      if (allocation.transactionId === reimbursementId) {
        throw new Error("A transaction cannot reimburse itself");
      }
      const capacity = await this.getTargetReimbursementCapacity(
        userId,
        allocation.transactionId,
        reimbursementId,
      );
      if (allocation.amount - capacity.remaining > 0.01) {
        throw new Error(
          `Reimbursed amount exceeds remaining amount for transaction ${allocation.transactionId}`,
        );
      }
    }

    // Update the reimbursing transaction
    const linkage: TransactionLinkage = {
      type: "reimbursement",
      reimbursesAllocations: reimbursedAllocations,
      leftoverAmount: Number((amountIn - totalAllocated).toFixed(2)),
      leftoverCategoryId: leftoverCategoryId ?? null,
    };

    await TransactionRepository.updateLinkageAndCategory(
      reimbursementId,
      userId,
      linkage,
      reimbursement.id,
    );

    await this.applyReimbursementBacklinks(
      userId,
      reimbursementId,
      reimbursedAllocations.filter((allocation) => allocation.amount > 0),
    );

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

    // If this was a reimbursement, clean up backlinks from reimbursed targets
    if (linkage?.type === "reimbursement") {
      const reimbursedIds = Array.from(
        new Set(
          this.normalizeReimbursementAllocations(linkage)
            .map((allocation) => allocation.transactionId || "")
            .filter(Boolean),
        ),
      );
      if (reimbursedIds.length > 0) {
        await this.removeReimbursementBacklinks(userId, id, reimbursedIds);
      }
    }
    // If this was a reimbursed transaction, clean up forward links from reimbursers
    if (linkage?.type === "reimbursed") {
      const reimburserIds = Array.from(
        new Set(
          (linkage.reimbursedByAllocations || [])
            .map((item) => item.transactionId || "")
            .filter(Boolean),
        ),
      );

      for (const reimburserId of reimburserIds) {
        const reimburser = await prisma.transaction.findUnique({
          where: { id: reimburserId },
          select: { linkage: true },
        });
        const reimburserLinkage = reimburser?.linkage as TransactionLinkage | null;
        if (!reimburserLinkage || reimburserLinkage.type !== "reimbursement") {
          continue;
        }

        const nextAllocations = (reimburserLinkage.reimbursesAllocations || []).filter(
          (allocation) => allocation.transactionId !== id,
        );

        if (nextAllocations.length === 0) {
          await TransactionRepository.updateLinkage(reimburserId, userId, null);
          continue;
        }

        await TransactionRepository.updateLinkage(reimburserId, userId, {
          ...reimburserLinkage,
          type: "reimbursement",
          reimbursesAllocations: nextAllocations,
        });
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

    const reimbursesIds = Array.from(
      new Set(
        this.normalizeReimbursementAllocations(linkage)
          .map((item) => item.transactionId || "")
          .filter(Boolean),
      ),
    ).filter((transactionId) => transactionId !== id);
    const reimbursedByIds = Array.from(
      new Set(
        (linkage.reimbursedByAllocations || [])
          .map((item) => item.transactionId),
      ),
    ).filter((transactionId) => transactionId !== id);

    const [reimbursesRaw, reimbursedByRaw] = await Promise.all([
      reimbursesIds.length
        ? TransactionRepository.getLinkedTransactions(userId, reimbursesIds)
        : [],
      reimbursedByIds.length
        ? TransactionRepository.getLinkedTransactions(userId, reimbursedByIds)
        : [],
    ]);

    const reimbursesAmountMap = new Map(
      (linkage.reimbursesAllocations || [])
        .filter((item) => typeof item.transactionId === "string")
        .map((item) => [item.transactionId as string, Number(item.amount || 0)]),
    );
    const reimbursedByAmountMap = new Map(
      (linkage.reimbursedByAllocations || []).map((item) => [
        item.transactionId,
        Number(item.amount || 0),
      ]),
    );

    const reimburses = reimbursesRaw.map((row: any) => ({
      ...row,
      reimbursementAmount: reimbursesAmountMap.get(row.id) ?? null,
    }));
    const reimbursedBy = reimbursedByRaw.map((row: any) => ({
      ...row,
      reimbursementAmount: reimbursedByAmountMap.get(row.id) ?? null,
    }));

    return {
      reimburses,
      reimbursedBy,
      leftoverAmount: linkage.leftoverAmount ?? null,
      leftoverCategoryId: linkage.leftoverCategoryId ?? null,
    };
  }

  /**
   * Search transactions for reimbursement linking
   */
  static async searchForReimbursement(
    userId: string,
    query: string | undefined,
    limit: number = 20,
    offset: number = 0,
    filters?: {
      transactionType?: "in" | "out";
      categoryId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ) {
    return TransactionRepository.searchForReimbursement(
      userId,
      query,
      limit,
      offset,
      filters,
    );
  }

  static async repairInvalidLinkages(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      select: {
        id: true,
        linkage: true,
      },
    });
    const linkageByTransactionId = new Map<string, TransactionLinkage | null>();
    transactions.forEach((transaction) => {
      linkageByTransactionId.set(
        transaction.id,
        (transaction.linkage as TransactionLinkage | null) || null,
      );
    });

    let fixedCount = 0;

    for (const transaction of transactions) {
      const linkage = transaction.linkage as TransactionLinkage | null;
      const sanitized = this.sanitizeLinkageForTransaction(
        transaction.id,
        linkage,
        { linkageByTransactionId, targetId: transaction.id },
      );

      const before = JSON.stringify(linkage ?? null);
      const after = JSON.stringify(sanitized ?? null);

      if (before !== after) {
        await TransactionRepository.updateLinkage(
          transaction.id,
          userId,
          sanitized,
        );
        linkageByTransactionId.set(transaction.id, sanitized);
        fixedCount += 1;
      }
    }

    return { fixedCount };
  }
}
