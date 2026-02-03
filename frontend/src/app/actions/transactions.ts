"use server";

import { auth } from "@/lib/auth";

const DATA_SERVICE_URL =
  process.env.DATA_SERVICE_URL || "http://localhost:4001";

export interface ImportTransaction {
  date: Date | string;
  description: string;
  label?: string;
  categoryId?: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  accountNumber?: string;
  source?: string;
  metadata?: any;
}

export interface DuplicateMatch {
  transaction: {
    id: string;
    date: Date;
    description: string;
    amountIn: number | null;
    amountOut: number | null;
    category?: {
      name: string;
      color: string;
    };
  };
  matchScore: number;
  matchReasons: string[];
}

export interface CheckImportResult {
  duplicates: Array<{
    index: number;
    matches: DuplicateMatch[];
  }>;
  cleanCount: number;
}

export interface CommitImportResult {
  success: boolean;
  importedCount?: number;
  batchId?: string;
  error?: string;
}

/**
 * Check import for duplicates without committing
 */
export async function checkImportDuplicates(
  transactions: ImportTransaction[],
): Promise<CheckImportResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/transactions/check-import`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: session.user.id,
        transactions,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to check duplicates");
  }

  return response.json();
}

/**
 * Commit selected transactions to database
 */
export async function commitImport(
  transactions: ImportTransaction[],
  selectedIndices: number[],
  batchInfo?: {
    filename: string;
    fileType: string;
    parserId: string;
  },
): Promise<CommitImportResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/transactions/commit-import`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: session.user.id,
        transactions,
        selectedIndices,
        batchInfo,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to commit import");
  }

  return response.json();
}

/**
 * Get transactions with filters
 */
export async function getTransactions(filters?: {
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const params = new URLSearchParams({
    userId: session.user.id,
    ...(filters?.dateFrom && { dateFrom: filters.dateFrom.toISOString() }),
    ...(filters?.dateTo && { dateTo: filters.dateTo.toISOString() }),
    ...(filters?.categoryId && { categoryId: filters.categoryId }),
    ...(filters?.search && { search: filters.search }),
    ...(filters?.limit && { limit: filters.limit.toString() }),
    ...(filters?.offset && { offset: filters.offset.toString() }),
  });

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/transactions?${params}`,
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch transactions");
  }

  return response.json();
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(
    `${DATA_SERVICE_URL}/api/transactions/${id}?userId=${session.user.id}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete transaction");
  }

  return response.json();
}

/**
 * Update a transaction
 */
export async function updateTransaction(
  id: string,
  data: Partial<ImportTransaction>,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${DATA_SERVICE_URL}/api/transactions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: session.user.id,
      ...data,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update transaction");
  }

  return response.json();
}
