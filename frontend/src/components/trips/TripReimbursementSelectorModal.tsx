"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightCircle, Receipt, X } from "lucide-react";
import { searchTripEntriesForReimbursement, type TripReimbursementCandidate } from "@/app/actions/trips";
import type { Transaction, TransactionLinkage } from "@/components/transaction-table/types";
import { Button } from "@/components/ui/Button";
import { ExistingTransactionsSelector } from "@/components/ui/ExistingTransactionsSelector";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";

interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

interface TripReimbursementSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (linkage: TransactionLinkage) => void;
  tripId: string;
  currentIndex: number;
  transactions: Transaction[];
  currentLinkage?: TransactionLinkage | null;
  categories: CategoryOption[];
  baseCurrency: string;
  hideCurrentImportSection?: boolean;
  excludeEntryId?: string;
}

const PAGE_SIZE = 20;

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toAbsAmount = (transaction?: Transaction | null) => {
  if (!transaction) return 0;
  const out = toNumber(transaction.amountOut);
  const incoming = toNumber(transaction.amountIn);
  return out > 0 ? out : incoming > 0 ? incoming : 0;
};

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

type TargetKey = string;
const toDbKey = (id: string) => `db:${id}`;
const toBatchKey = (index: number) => `batch:${index}`;

const getTransactionCurrency = (
  transaction: Transaction | undefined,
  fallback: string,
) => {
  const metadata =
    transaction?.metadata && typeof transaction.metadata === "object"
      ? (transaction.metadata as Record<string, unknown>)
      : null;
  const raw = String(
    metadata?.currency ||
      metadata?.statementCurrency ||
      transaction?.metadata?.toCurrency ||
      fallback,
  )
    .trim()
    .toUpperCase();
  return raw || fallback.toUpperCase();
};

export function TripReimbursementSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  tripId,
  currentIndex,
  transactions,
  currentLinkage,
  categories,
  baseCurrency,
  hideCurrentImportSection = false,
  excludeEntryId,
}: TripReimbursementSelectorModalProps) {
  const currentTransaction = transactions[currentIndex];
  const reimbursementLocalAmount = toAbsAmount(currentTransaction);
  const reimbursementCurrency = getTransactionCurrency(
    currentTransaction,
    baseCurrency,
  );
  const requiresManualValuation =
    reimbursementCurrency.toUpperCase() !== baseCurrency.toUpperCase();

  const [valuationInputMode, setValuationInputMode] = useState<
    "amount" | "fxRate"
  >("amount");
  const [reimbursementBaseAmountInput, setReimbursementBaseAmountInput] =
    useState("");
  const [reimbursementFxInput, setReimbursementFxInput] = useState("");
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
  const [dbRows, setDbRows] = useState<TripReimbursementCandidate[]>([]);
  const [dbTotal, setDbTotal] = useState(0);
  const [dbPage, setDbPage] = useState(1);
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  const loadExisting = useCallback(
    async (page: number, query: string) => {
      setIsLoadingDb(true);
      try {
        const offset = (page - 1) * PAGE_SIZE;
        const result = await searchTripEntriesForReimbursement(tripId, {
          search: query || undefined,
          limit: PAGE_SIZE,
          offset,
          excludeEntryId,
        });
        setDbRows(result.transactions || []);
        setDbTotal(result.total || 0);
      } finally {
        setIsLoadingDb(false);
      }
    },
    [excludeEntryId, tripId],
  );

  useEffect(() => {
    if (!isOpen) return;

    const initialBatch = new Set<number>();
    const initialDb = new Set<string>();
    const initialAllocations: Record<TargetKey, number> = {};
    (currentLinkage?.reimbursesAllocations || []).forEach((item) => {
      const amountValue = Number((item as any).amount || (item as any).amountBase || 0);
      if (typeof item.transactionId === "string") {
        initialDb.add(item.transactionId);
        initialAllocations[toDbKey(item.transactionId)] = amountValue;
      } else if (typeof item.pendingBatchIndex === "number") {
        initialBatch.add(item.pendingBatchIndex);
        initialAllocations[toBatchKey(item.pendingBatchIndex)] = amountValue;
      }
    });
    setSelectedBatchIndices(initialBatch);
    setSelectedDbIds(initialDb);
    setAllocationByTarget(initialAllocations);
    setLeftoverCategoryId(currentLinkage?.leftoverCategoryId || "");
    setSearchQuery("");
    setDbPage(1);
    setActiveTarget(null);
    setValuationInputMode("amount");
    setReimbursementBaseAmountInput(
      currentLinkage?.reimbursementBaseAmount
        ? String(currentLinkage.reimbursementBaseAmount)
        : requiresManualValuation
          ? ""
          : String(reimbursementLocalAmount),
    );
    setReimbursementFxInput(
      currentLinkage?.reimbursingFxRate
        ? String(currentLinkage.reimbursingFxRate)
        : "",
    );
    void loadExisting(1, "");
  }, [
    currentLinkage,
    isOpen,
    loadExisting,
    reimbursementLocalAmount,
    requiresManualValuation,
  ]);

  const selectableBatch = useMemo(
    () =>
      hideCurrentImportSection
        ? []
        :
      transactions
        .map((transaction, index) => ({ transaction, index }))
        .filter(({ transaction, index }) => {
          if (index === currentIndex) return false;
          if (!(toNumber(transaction.amountOut) > 0)) return false;
          if (transaction.entryTypeOverride === "funding_out") return false;
          const txType = String(
            (transaction.metadata as Record<string, unknown> | null)
              ?.transactionType || "",
          )
            .trim()
            .toLowerCase();
          if (txType === "conversion" || txType === "topup") return false;
          return true;
        }),
    [transactions, currentIndex, hideCurrentImportSection],
  );

  const selectedBatchItems = selectableBatch.filter((item) =>
    selectedBatchIndices.has(item.index),
  );
  const selectedDbItems = dbRows.filter((item) => selectedDbIds.has(item.id));

  const selectedItems = [
    ...selectedBatchItems.map((item) => ({
      key: toBatchKey(item.index),
      title: item.transaction.label?.trim() || item.transaction.description,
      subtitle: `${formatDate(item.transaction.date)} · Current import`,
      maxBaseAmount: toAbsAmount(item.transaction),
      alreadyAllocatedBase: 0,
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
      subtitle: `${formatDate(item.date)} · Existing trip entry`,
      maxBaseAmount: item.baseAmount,
      alreadyAllocatedBase: item.alreadyAllocatedBase,
      onRemove: () =>
        setSelectedDbIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        }),
    })),
  ];

  const resolvedReimbursementBaseAmount = useMemo(() => {
    if (!requiresManualValuation) return reimbursementLocalAmount;
    if (valuationInputMode === "amount") {
      return Number(reimbursementBaseAmountInput || 0);
    }
    const fx = Number(reimbursementFxInput || 0);
    if (!(fx > 0)) return 0;
    return Number((reimbursementLocalAmount * fx).toFixed(4));
  }, [
    reimbursementBaseAmountInput,
    reimbursementFxInput,
    reimbursementLocalAmount,
    requiresManualValuation,
    valuationInputMode,
  ]);
  const reimbursementBaseAmount = resolvedReimbursementBaseAmount;

  const totalAllocated = selectedItems.reduce(
    (sum, item) =>
      sum + Math.min(toNumber(allocationByTarget[item.key]), item.maxBaseAmount),
    0,
  );
  const remainingBase = Number((reimbursementBaseAmount - totalAllocated).toFixed(4));

  const getBudgetForKey = (key: string) => {
    const allocatedByOthers = selectedItems
      .filter((item) => item.key !== key)
      .reduce(
        (sum, item) => sum + Math.min(toNumber(allocationByTarget[item.key]), item.maxBaseAmount),
        0,
      );
    return Number(Math.max(reimbursementBaseAmount - allocatedByOthers, 0).toFixed(4));
  };

  const setAllocation = (key: string, value: number) => {
    setAllocationByTarget((prev) => ({
      ...prev,
      [key]: Number.isFinite(value) ? Number(value.toFixed(4)) : 0,
    }));
  };

  const activeSelected = selectedItems.find((item) => item.key === activeTarget);

  const formatBase = (value: number) =>
    `${value.toFixed(2)} ${baseCurrency.toUpperCase()}`;

  const handleConfirm = () => {
    if (
      requiresManualValuation &&
      !(reimbursementBaseAmount > 0) &&
      reimbursementLocalAmount > 0
    ) {
      return;
    }

    const reimbursesAllocations = selectedItems
      .map((item) => {
        const amount = Math.min(toNumber(allocationByTarget[item.key]), item.maxBaseAmount);
        if (amount <= 0) return null;
        if (item.key.startsWith("db:")) {
          return { transactionId: item.key.slice(3), amount };
        }
        return { pendingBatchIndex: Number(item.key.slice(6)), amount };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    const linkage: TransactionLinkage = {
      type: "reimbursement",
      reimbursesAllocations,
      leftoverAmount: Number(Math.max(remainingBase, 0).toFixed(4)),
      leftoverCategoryId:
        remainingBase > 0 && leftoverCategoryId ? leftoverCategoryId : null,
      reimbursementBaseAmount: Number(reimbursementBaseAmount.toFixed(4)),
      reimbursingFxRate:
        reimbursementLocalAmount > 0
          ? Number((reimbursementBaseAmount / reimbursementLocalAmount).toFixed(8))
          : undefined,
    };

    onConfirm(linkage);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-dark-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-stroke p-6 pb-4 dark:border-dark-3">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-green" />
            <div>
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Trip Reimbursement Allocation
              </h3>
              <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
                Allocate reimbursement amount in base currency across trip spending entries.
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
            {!hideCurrentImportSection && (
              <div className="flex min-h-0 flex-col rounded-lg border border-stroke dark:border-dark-3">
                <div className="border-b border-stroke dark:border-dark-3 px-3 py-2 text-sm font-medium text-dark dark:text-white">
                  Current Import Spending Rows
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {selectableBatch.map((item) => {
                    const key = toBatchKey(item.index);
                    const maxAmount = toAbsAmount(item.transaction);
                    const selected = selectedBatchIndices.has(item.index);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedBatchIndices((prev) => new Set(prev).add(item.index));
                          if (allocationByTarget[key] === undefined) {
                            setAllocation(key, Math.min(maxAmount, getBudgetForKey(key)));
                          }
                          setActiveTarget(key);
                        }}
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
                            {formatDate(item.transaction.date)}
                          </span>
                          <span className="text-sm font-medium text-red">
                            {formatBase(maxAmount)}
                          </span>
                        </div>
                        <p className="truncate text-sm text-dark dark:text-white">
                          {item.transaction.label?.trim() || item.transaction.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ExistingTransactionsSelector
              title={
                hideCurrentImportSection
                  ? "Trip Spending Entries"
                  : "Existing Trip Spending Entries"
              }
              searchPlaceholder="Search label or description..."
              searchValue={searchQuery}
              onSearchValueChange={setSearchQuery}
              onSearch={() => {
                setDbPage(1);
                return loadExisting(1, searchQuery);
              }}
              isLoading={isLoadingDb}
              transactions={dbRows.map((item) => ({
                id: item.id,
                date: item.date,
                description: item.description,
                label: item.label,
                amountIn: null,
                amountOut: item.baseAmount,
              }))}
              selectedIds={selectedDbIds}
              onToggleSelect={(id) => {
                const row = dbRows.find((item) => item.id === id);
                if (!row) return;
                setSelectedDbIds((prev) => new Set(prev).add(id));
                const key = toDbKey(id);
                if (allocationByTarget[key] === undefined) {
                  setAllocation(key, Math.min(row.remainingBase, getBudgetForKey(key)));
                }
                setActiveTarget(key);
              }}
              totalItems={dbTotal}
              currentPage={dbPage}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => {
                setDbPage(page);
                return loadExisting(page, searchQuery);
              }}
              emptyMessage="No existing trip spending entries found."
            />
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border border-stroke dark:border-dark-3">
            <div className="border-b border-stroke p-3 dark:border-dark-3">
              <div className="text-sm font-semibold text-dark dark:text-white">
                Reimbursement Settings
              </div>
              <div className="mt-2 rounded-lg border border-stroke bg-gray-1/60 p-2 text-xs text-dark-5 dark:border-dark-3 dark:bg-dark-3/40 dark:text-dark-6">
                Reimbursement inflow:{" "}
                <span className="font-medium text-dark dark:text-white">
                  {reimbursementLocalAmount.toFixed(2)} {reimbursementCurrency}
                </span>
              </div>
              {requiresManualValuation && (
                <div className="mt-2 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                  <p className="text-xs font-medium text-dark dark:text-white">
                    Cross-currency reimbursement valuation required
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-dark dark:text-white">
                      <input
                        type="radio"
                        checked={valuationInputMode === "amount"}
                        onChange={() => setValuationInputMode("amount")}
                      />
                      Base amount
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-dark dark:text-white">
                      <input
                        type="radio"
                        checked={valuationInputMode === "fxRate"}
                        onChange={() => setValuationInputMode("fxRate")}
                      />
                      FX rate ({reimbursementCurrency}→{baseCurrency})
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <NumberInput
                      value={reimbursementBaseAmountInput}
                      onChange={(event) =>
                        setReimbursementBaseAmountInput(event.target.value)
                      }
                      placeholder={`Base amount (${baseCurrency})`}
                      disabled={valuationInputMode !== "amount"}
                    />
                    <NumberInput
                      value={reimbursementFxInput}
                      onChange={(event) => setReimbursementFxInput(event.target.value)}
                      placeholder="FX rate"
                      disabled={valuationInputMode !== "fxRate"}
                    />
                  </div>
                </div>
              )}
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-dark-5 dark:text-dark-6">Initial amount</span>
                  <span className="font-semibold text-green">
                    {formatBase(reimbursementBaseAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-5 dark:text-dark-6">Allocated</span>
                  <span className="font-semibold text-dark dark:text-white">
                    {formatBase(totalAllocated)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-5 dark:text-dark-6">Remaining</span>
                  <span
                    className={`font-semibold ${
                      remainingBase < 0 ? "text-red" : "text-primary"
                    }`}
                  >
                    {formatBase(remainingBase)}
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

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {activeSelected && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="text-xs text-dark-5 dark:text-dark-6">
                    Active transaction
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-dark dark:text-white">
                    {activeSelected.title}
                  </div>
                  <div className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                    Max reimbursable: {formatBase(activeSelected.maxBaseAmount)}
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <NumberInput
                      value={allocationByTarget[activeSelected.key] ?? ""}
                      onChange={(event) =>
                        setAllocation(
                          activeSelected.key,
                          Math.min(
                            Number(event.target.value || 0),
                            Math.min(
                              activeSelected.maxBaseAmount,
                              getBudgetForKey(activeSelected.key),
                            ),
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
                            Math.min(
                              activeSelected.maxBaseAmount,
                              getBudgetForKey(activeSelected.key),
                            ),
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
                              Number((activeSelected.maxBaseAmount / 2).toFixed(4)),
                              getBudgetForKey(activeSelected.key),
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
                {selectedItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-dark-5 dark:text-dark-6">
                    Select transactions from the left panel.
                  </div>
                ) : (
                  selectedItems.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-stroke p-2 dark:border-dark-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTarget(item.key)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-medium text-dark dark:text-white">
                            {item.title}
                          </p>
                          <p className="text-xs text-dark-5 dark:text-dark-6">
                            {item.subtitle}
                          </p>
                          <p className="text-xs text-dark-5 dark:text-dark-6">
                            Max reimbursable: {formatBase(item.maxBaseAmount)}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-green">
                            {formatBase(
                              Math.min(
                                toNumber(allocationByTarget[item.key]),
                                item.maxBaseAmount,
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
                              if (activeTarget === item.key) setActiveTarget(null);
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
            disabled={
              selectedItems.length === 0 ||
              remainingBase < -0.0001 ||
              (requiresManualValuation && !(reimbursementBaseAmount > 0))
            }
            leftIcon={<ArrowRightCircle className="h-4 w-4" />}
          >
            Save Reimbursement
          </Button>
        </div>
      </div>
    </div>
  );
}
