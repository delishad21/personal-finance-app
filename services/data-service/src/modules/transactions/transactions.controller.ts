import { Router, Request, Response } from "express";
import { TransactionService } from "./transactions.service";
import { z } from "zod";

export const transactionRouter = Router();

// Validation schemas
const ImportTransactionSchema = z.object({
  date: z.string().transform((str: string) => new Date(str)),
  description: z.string(),
  label: z.string().optional(),
  categoryId: z.string().nullish(),
  amountIn: z.number().nullish(),
  amountOut: z.number().nullish(),
  balance: z.number().nullish(),
  accountNumber: z.string().nullish(),
  source: z.string().nullish(),
  metadata: z.any().optional(),
});

const CheckImportSchema = z.object({
  userId: z.string(),
  transactions: z.array(ImportTransactionSchema),
});

const CommitImportSchema = z.object({
  userId: z.string(),
  transactions: z.array(ImportTransactionSchema),
  selectedIndices: z.array(z.number()),
  batchInfo: z
    .object({
      filename: z.string(),
      fileType: z.string(),
      parserId: z.string(),
    })
    .optional(),
});

const GetTransactionsSchema = z.object({
  userId: z.string(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

/**
 * POST /api/transactions/check-import
 * Check for duplicates without committing
 */
transactionRouter.post("/check-import", async (req: Request, res: Response) => {
  try {
    const { userId, transactions } = CheckImportSchema.parse(req.body);

    const result = await TransactionService.checkImport(userId, transactions);

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/transactions/commit-import
 * Commit selected transactions to database
 */
transactionRouter.post(
  "/commit-import",
  async (req: Request, res: Response) => {
    try {
      const { userId, transactions, selectedIndices, batchInfo } =
        CommitImportSchema.parse(req.body);

      const result = await TransactionService.commitImport(
        userId,
        transactions,
        selectedIndices,
        batchInfo,
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * GET /api/transactions
 * Get transactions with filters
 */
transactionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const filters = {
      userId: req.query.userId as string,
      dateFrom: req.query.dateFrom
        ? new Date(req.query.dateFrom as string)
        : undefined,
      dateTo: req.query.dateTo
        ? new Date(req.query.dateTo as string)
        : undefined,
      categoryId: req.query.categoryId as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset
        ? parseInt(req.query.offset as string)
        : undefined,
    };

    const result = await TransactionService.getTransactions(
      filters.userId,
      filters,
    );

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/transactions/:id
 * Get single transaction
 */
transactionRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const transaction = await TransactionService.getTransaction(id, userId);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(transaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/transactions/:id
 * Update transaction
 */
transactionRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId as string;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const transaction = await TransactionService.updateTransaction(
      id,
      userId,
      req.body,
    );

    res.json(transaction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/transactions/:id
 * Delete single transaction
 */
transactionRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    await TransactionService.deleteTransaction(id, userId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/transactions/bulk-delete
 * Delete multiple transactions
 */
transactionRouter.post("/bulk-delete", async (req: Request, res: Response) => {
  try {
    const { userId, ids } = req.body;

    if (!userId || !ids || !Array.isArray(ids)) {
      return res
        .status(400)
        .json({ error: "userId and ids array are required" });
    }

    await TransactionService.deleteTransactions(ids, userId);

    res.json({ success: true, deletedCount: ids.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
