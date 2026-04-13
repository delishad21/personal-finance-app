"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Receipt, X, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { ExistingTransactionsSelector } from "@/components/ui/ExistingTransactionsSelector";
import {
  Transaction,
  TransactionLinkage,
} from "@/components/transaction-table/types";
import { searchTransactionsForReimbursement } from "@/app/actions/transactions";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface DatabaseTransaction {
  id: string;
  date: string;
  description: string;
  label?: string | null;
  amountIn: number | null;
  amountOut: number | null;
  category?: {
    name: string;
    color: string;
  } | null;
  linkage?: TransactionLinkage | null;
}

interface ReimbursementSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (linkage: TransactionLinkage) => void;
  currentIndex: number;
  transactions: Transaction[];
  currentLinkage?: TransactionLinkage | null;
  includeCurrentImport?: boolean;
  excludeTransactionId?: string;
  categories?: Category[];
  currentReimbursementId?: string;
}

const PAGE_SIZE = 20;

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toAbsTransactionAmount = (amountIn?: number | null, amountOut?: number | null) => {
  const inValue = toNumber(amountIn);
  const outValue = toNumber(amountOut);
  if (outValue > 0) return outValue;
  if (inValue > 0) return inValue;
  return 0;
};

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatAmount = (amount: number) => `$${amount.toFixed(2)}`;

type TargetKey = string;
const toDbKey = (id: string) => `db:${id}`;
const toBatchKey = (index: number) => `batch:${index}`;

export function ReimbursementSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  currentIndex,
  transactions,
  currentLinkage,
  includeCurrentImport = true,
  excludeTransactionId,
  categories = [],
  currentReimbursementId,
}: ReimbursementSelectorModalProps) {
  const reimbursementAmount = toAbsTransactionAmount(
    transactions[currentIndex]?.amountIn,
    transactions[currentIndex]?.amountOut,
  );
  const [selectedBatchIndices, setSelectedBatchIndices] = useState<Set<number>>(
    new Set(),
  );
  const [selectedDbIds, setSelectedDbIds] = useState<Set<string>>(new Set());
  const [allocationByTarget, setAllocationByTarget] = useState<
    Record<TargetKey, number>
  >({});
  const [leftoverCategoryId, setLeftoverCategoryId] = useState("");
  const [activeTarget, setActiveTarget] = useState<TargetKey | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [dbTransactions, setDbTransactions] = useState<DatabaseTransaction[]>([]);
  const [dbTotal, setDbTotal] = useState(0);
  const [dbPage, setDbPage] = useState(1);
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  const loadExistingTransactions = useCallback(
    async (page: number, query: string) => {
      setIsLoadingDb(true);
      try {
        const offset = (page - 1) * PAGE_SIZE;
        const result = await searchTransactionsForReimbursement(
          query || undefined,
          PAGE_SIZE,
          offset,
        );
        const allResults = (result?.transactions || []) as DatabaseTransaction[];
        const filtered = excludeTransactionId
          ? allResults.filter((item) => item.id !== excludeTransactionId)
          : allResults;
        setDbTransactions(filtered);
        setDbTotal(
          typeof result?.total === "number" ? result.total : filtered.length,
        );
      } finally {
        setIsLoadingDb(false);
      }
    },
    [excludeTransactionId],
  );

  useEffect(() => {
    if (!isOpen) return;

    const initialBatch = new Set<number>();
    const initialDb = new Set<string>();
    const initialAllocations: Record<TargetKey, number> = {};
    (currentLinkage?.reimbursesAllocations || []).forEach((item) => {
      if (typeof item.transactionId === "string") {
        initialDb.add(item.transactionId);
        initialAllocations[toDbKey(item.transactionId)] = toNumber(item.amount);
      } else if (typeof item.pendingBatchIndex === "number") {
        initialBatch.add(item.pendingBatchIndex);
        initialAllocations[toBatchKey(item.pendingBatchIndex)] = toNumber(
          item.amount,
        );
      }
    });

    setSelectedBatchIndices(initialBatch);
    setSelectedDbIds(initialDb);
    setAllocationByTarget(initialAllocations);
    setLeftoverCategoryId(currentLinkage?.leftoverCategoryId || "");
    setSearchQuery("");
    setDbPage(1);
    setActiveTarget(null);
    loadExistingTransactions(1, "");
  }, [isOpen, currentLinkage, loadExistingTransactions]);

  const selectableBatchTransactions = useMemo(
    () =>
      transactions
        .map((transaction, index) => ({ ...transaction, index }))
        .filter(
          (transaction) =>
            transaction.index !== currentIndex &&
            transaction.linkage?.type !== "reimbursement",
        ),
    [transactions, currentIndex],
  );

  const selectedBatchItems = selectableBatchTransactions.filter((item) =>
    selectedBatchIndices.has(item.index),
  );
  const selectedDbItems = dbTransactions.filter((item) =>
    selectedDbIds.has(item.id),
  );

  const selectedItems = [
    ...selectedBatchItems.map((item) => ({
      key: toBatchKey(item.index),
      title: item.label?.trim() || item.description,
      subtitle: `${formatDate(item.date)} · Current import`,
      maxAmount: toAbsTransactionAmount(item.amountIn, item.amountOut),
      alreadyAllocated: 0,
      onRemove: () =>
        setSelectedBatchIndices((prev) => {
          const next = new Set(prev);
          next.delete(item.index);
          return next;
        }),
    })),
    ...selectedDbItems.map((item) => ({
      key: toDbKey(item.id),
      title: item.label?.trim() || item.description,
      subtitle: `${formatDate(item.date)} · Existing transaction`,
      maxAmount: toAbsTransactionAmount(item.amountIn, item.amountOut),
      alreadyAllocated: Number(
        (item.linkage?.reimbursedByAllocations || [])
          .filter((allocation) => allocation.transactionId !== currentReimbursementId)
          .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0)
          .toFixed(2),
      ),
      onRemove: () =>
        setSelectedDbIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        }),
    })),
  ];

  const selectedItemsWithRemaining = selectedItems.map((item) => {
    const alreadyAllocated = Number((item.alreadyAllocated || 0).toFixed(2));
    const remainingReimbursable = Number(
      Math.max(item.maxAmount - alreadyAllocated, 0).toFixed(2),
    );
    return { ...item, alreadyAllocated, remainingReimbursable };
  });

  const totalAllocated = selectedItemsWithRemaining.reduce(
    (sum, item) =>
      sum +
      Math.min(
        toNumber(allocationByTarget[item.key]),
        Number(item.remainingReimbursable),
      ),
    0,
  );
  const remaining = Number((reimbursementAmount - totalAllocated).toFixed(2));

  const getBudgetForKey = (key: string) => {
    const allocatedByOthers = selectedItemsWithRemaining
      .filter((item) => item.key !== key)
      .reduce(
        (sum, item) =>
          sum +
          Math.min(
            toNumber(allocationByTarget[item.key]),
            Number(item.remainingReimbursable),
          ),
        0,
      );
    return Number(Math.max(reimbursementAmount - allocatedByOthers, 0).toFixed(2));
  };

  const getMaxAllowedForItem = (item: {
    key: string;
    remainingReimbursable: number;
  }) => Math.min(item.remainingReimbursable, getBudgetForKey(item.key));

  const setAllocation = (key: string, value: number) => {
    setAllocationByTarget((prev) => ({
      ...prev,
      [key]: Number.isFinite(value) ? Number(value.toFixed(2)) : 0,
    }));
  };

  const activateAndSeed = (
    key: string,
    maxAmount: number,
    select: () => void,
  ) => {
    select();
    if (allocationByTarget[key] === undefined) {
      setAllocation(key, Math.min(maxAmount, getBudgetForKey(key)));
    }
    setActiveTarget(key);
  };

  const handleConfirm = () => {
    const reimburseAllocations = selectedItemsWithRemaining
      .map((item) => {
        const amount = Math.min(
          toNumber(allocationByTarget[item.key]),
          getMaxAllowedForItem(item),
        );
        if (amount <= 0) return null;
        if (item.key.startsWith("db:")) {
          return {
            transactionId: item.key.slice(3),
            amount,
          };
        }
        return {
          pendingBatchIndex: Number(item.key.slice(6)),
          amount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    const linkage: TransactionLinkage = {
      type: "reimbursement",
      reimbursesAllocations: reimburseAllocations,
      leftoverAmount: Number(Math.max(remaining, 0).toFixed(2)),
      leftoverCategoryId:
        remaining > 0 && leftoverCategoryId ? leftoverCategoryId : null,
    };

    onConfirm(linkage);
    onClose();
  };

  const activeSelected = selectedItemsWithRemaining.find(
    (item) => item.key === activeTarget,
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-dark-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-stroke p-6 pb-4 dark:border-dark-3">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-green" />
            <div>
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Reimbursement Allocation
              </h3>
              <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
                Allocate this reimbursement across one or more transactions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:bg-gray-1 dark:hover:bg-dark-3"
          >
            <X className="h-5 w-5 text-dark-5 dark:text-dark-6" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="grid min-h-0 gap-4">
            {includeCurrentImport && (
              <div className="flex min-h-0 flex-col rounded-lg border border-stroke dark:border-dark-3">
                <div className="border-b border-stroke dark:border-dark-3 px-3 py-2 text-sm font-medium text-dark dark:text-white">
                  Current Import
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2">
                  {selectableBatchTransactions.map((item) => {
                    const key = toBatchKey(item.index);
                    const maxAmount = toAbsTransactionAmount(
                      item.amountIn,
                      item.amountOut,
                    );
                    const selected = selectedBatchIndices.has(item.index);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          activateAndSeed(key, maxAmount, () =>
                            setSelectedBatchIndices((prev) => {
                              const next = new Set(prev);
                              next.add(item.index);
                              return next;
                            }),
                          )
                        }
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          activeTarget === key
                            ? "border-primary bg-primary/5"
                            : selected
                              ? "border-green/40 bg-green/10"
                              : "border-transparent hover:border-stroke hover:bg-gray-1 dark:hover:border-dark-3 dark:hover:bg-dark-3"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-dark-5 dark:text-dark-6">
                            {formatDate(item.date)}
                          </span>
                          <span className="text-sm font-medium text-red">
                            {formatAmount(maxAmount)}
                          </span>
                        </div>
                        <p className="truncate text-sm text-dark dark:text-white">
                          {item.label?.trim() || item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ExistingTransactionsSelector
              title="Existing Transactions"
              searchPlaceholder="Search label or description..."
              searchValue={searchQuery}
              onSearchValueChange={setSearchQuery}
              onSearch={() => {
                setDbPage(1);
                return loadExistingTransactions(1, searchQuery);
              }}
              isLoading={isLoadingDb}
              transactions={dbTransactions}
              selectedIds={selectedDbIds}
              onToggleSelect={(id) => {
                const item = dbTransactions.find((row) => row.id === id);
                if (!item) return;
                  const alreadyAllocated = Number(
                    (item.linkage?.reimbursedByAllocations || [])
                      .filter(
                        (allocation) =>
                          allocation.transactionId !== currentReimbursementId,
                      )
                      .reduce(
                        (sum, allocation) => sum + Number(allocation.amount || 0),
                        0,
                      )
                      .toFixed(2),
                  );
                  const remainingReimbursable = Number(
                    Math.max(
                      toAbsTransactionAmount(item.amountIn, item.amountOut) -
                        alreadyAllocated,
                      0,
                    ).toFixed(2),
                  );
                  activateAndSeed(
                    toDbKey(id),
                    remainingReimbursable,
                    () =>
                      setSelectedDbIds((prev) => {
                      const next = new Set(prev);
                      next.add(id);
                      return next;
                    }),
                );
              }}
              totalItems={dbTotal}
              currentPage={dbPage}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => {
                setDbPage(page);
                return loadExistingTransactions(page, searchQuery);
              }}
              emptyMessage="No existing transactions found."
            />
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border border-stroke dark:border-dark-3">
            <div className="border-b border-stroke dark:border-dark-3 p-3">
              <div className="text-sm font-semibold text-dark dark:text-white">
                Reimbursement Settings
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-dark-5 dark:text-dark-6">Initial amount</span>
                  <span className="font-semibold text-green">
                    {formatAmount(reimbursementAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-5 dark:text-dark-6">Allocated</span>
                  <span className="font-semibold text-dark dark:text-white">
                    {formatAmount(totalAllocated)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-5 dark:text-dark-6">Remaining</span>
                  <span
                    className={`font-semibold ${
                      remaining < 0 ? "text-red" : "text-primary"
                    }`}
                  >
                    {formatAmount(remaining)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-b border-stroke p-3 dark:border-dark-3">
              <label className="mb-1 block text-xs font-medium text-dark-5 dark:text-dark-6">
                Leftover Category (optional)
              </label>
              <Select
                value={leftoverCategoryId}
                onChange={setLeftoverCategoryId}
                options={[
                  { value: "", label: "Uncategorized" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
              {activeSelected && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="text-xs text-dark-5 dark:text-dark-6">
                    Active transaction
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-dark dark:text-white">
                    {activeSelected.title}
                  </div>
                  <div className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                    Reimbursable: {formatAmount(activeSelected.remainingReimbursable)}
                    {activeSelected.alreadyAllocated > 0
                      ? ` (already reimbursed ${formatAmount(activeSelected.alreadyAllocated)})`
                      : ""}
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <NumberInput
                      value={allocationByTarget[activeSelected.key] ?? ""}
                      onChange={(value) =>
                        setAllocation(
                          activeSelected.key,
                          Math.min(
                            Number(value || 0),
                            getMaxAllowedForItem(activeSelected),
                          ),
                        )
                      }
                      step="0.01"
                      min="0"
                    />
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setAllocation(
                            activeSelected.key,
                            getMaxAllowedForItem(activeSelected),
                          )
                        }
                      >
                        Full
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setAllocation(
                            activeSelected.key,
                            Math.min(
                              Number((activeSelected.maxAmount / 2).toFixed(2)),
                              getMaxAllowedForItem(activeSelected),
                            ),
                          )
                        }
                      >
                        1/2
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {selectedItemsWithRemaining.length === 0 ? (
                  <div className="py-6 text-center text-sm text-dark-5 dark:text-dark-6">
                    Select transactions from the left panel.
                  </div>
                ) : (
                  selectedItemsWithRemaining.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-stroke p-2 dark:border-dark-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTarget(item.key)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="truncate text-sm font-medium text-dark dark:text-white">
                            {item.title}
                          </p>
                          <p className="text-xs text-dark-5 dark:text-dark-6">
                            {item.subtitle}
                          </p>
                          <p className="text-xs text-dark-5 dark:text-dark-6">
                            Remaining reimbursable:{" "}
                            {formatAmount(item.remainingReimbursable)}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-green">
                            {formatAmount(
                              Math.min(
                                toNumber(allocationByTarget[item.key]),
                                getMaxAllowedForItem(item),
                              ),
                            )}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              item.onRemove();
                              setAllocationByTarget((prev) => {
                                const next = { ...prev };
                                delete next[item.key];
                                return next;
                              });
                              if (activeTarget === item.key) {
                                setActiveTarget(null);
                              }
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between border-t border-stroke p-4 dark:border-dark-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={handleConfirm}
            disabled={selectedItems.length === 0 || remaining < -0.01}
            leftIcon={<ArrowRightCircle className="h-4 w-4" />}
          >
            Save Reimbursement
          </Button>
        </div>
      </div>
    </div>
  );
}
