"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import { SearchBar } from "@/components/ui/SearchBar";
import { Select } from "@/components/ui/Select";
import {
  TransactionCard,
  type TransactionCardTransaction,
} from "@/components/transactions/TransactionCard";

export interface SelectableExistingTransaction {
  id: string;
  date: string;
  description: string;
  label?: string | null;
  amountIn: number | null;
  amountOut: number | null;
  balance?: number | null;
  currency?: string | null;
  accountIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
  category?: {
    id?: string;
    name: string;
    color: string;
  } | null;
}

interface ExistingTransactionsSelectorProps {
  className?: string;
  title: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
  transactions: SelectableExistingTransaction[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  recommendedTransactionId?: string;
  footerAction?: ReactNode;
  emptyMessage?: string;
  showExpandButton?: boolean;
  showSearchBar?: boolean;
}

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatAmount = (amountIn?: number | null, amountOut?: number | null) => {
  const inValue = toNumberOrNull(amountIn);
  const outValue = toNumberOrNull(amountOut);

  if (inValue && inValue > 0) return `+$${inValue.toFixed(2)}`;
  if (outValue && outValue > 0) return `-$${outValue.toFixed(2)}`;
  return "$0.00";
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function ExistingTransactionsSelector({
  className,
  title,
  searchPlaceholder = "Search transactions...",
  searchValue,
  onSearchValueChange,
  onSearch,
  isLoading = false,
  transactions,
  selectedIds,
  onToggleSelect,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  recommendedTransactionId,
  footerAction,
  emptyMessage = "No transactions found.",
  showExpandButton = true,
  showSearchBar = true,
}: ExistingTransactionsSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSearch, setExpandedSearch] = useState("");
  const [expandedType, setExpandedType] = useState<"all" | "in" | "out">(
    "all",
  );
  const [expandedCategory, setExpandedCategory] = useState("");
  const [expandedDateFrom, setExpandedDateFrom] = useState("");
  const [expandedDateTo, setExpandedDateTo] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const hasResults = transactions.length > 0;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const categoryOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    transactions.forEach((tx) => {
      if (!tx.category?.name) return;
      const key = tx.category.id || tx.category.name;
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: tx.category.name,
        });
      }
    });
    return [{ value: "", label: "All categories" }, ...Array.from(map.values())];
  }, [transactions]);

  const filteredExpandedRows = useMemo(() => {
    const searchLower = expandedSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesSearch =
        searchLower.length === 0 ||
        tx.description.toLowerCase().includes(searchLower) ||
        (tx.label || "").toLowerCase().includes(searchLower);

      const matchesType =
        expandedType === "all" ||
        (expandedType === "in" && (tx.amountIn || 0) > 0) ||
        (expandedType === "out" && (tx.amountOut || 0) > 0);

      const txCategoryKey = tx.category?.id || tx.category?.name || "";
      const matchesCategory =
        expandedCategory.length === 0 || txCategoryKey === expandedCategory;

      const txDate = tx.date || "";
      const matchesDateFrom = !expandedDateFrom || txDate >= expandedDateFrom;
      const matchesDateTo = !expandedDateTo || txDate <= expandedDateTo;

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    transactions,
    expandedSearch,
    expandedType,
    expandedCategory,
    expandedDateFrom,
    expandedDateTo,
  ]);

  const toCardTransaction = (
    transaction: SelectableExistingTransaction,
  ): TransactionCardTransaction => ({
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    label: transaction.label || undefined,
    amountIn: transaction.amountIn,
    amountOut: transaction.amountOut,
    balance: transaction.balance ?? null,
    currency: transaction.currency ?? null,
    accountIdentifier: transaction.accountIdentifier ?? null,
    metadata:
      transaction.metadata && typeof transaction.metadata === "object"
        ? (transaction.metadata as Record<string, any>)
        : undefined,
    category: transaction.category
      ? {
          id: transaction.category.id || transaction.category.name,
          name: transaction.category.name,
          color: transaction.category.color,
        }
      : undefined,
  });

  return (
    <div
      className={`flex min-h-0 flex-col rounded-lg border border-stroke dark:border-dark-3 ${className ?? ""}`}
    >
      <div className="border-b border-stroke dark:border-dark-3 px-3 py-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-dark dark:text-white">{title}</h4>
        {showExpandButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setExpandedSearch(searchValue);
              setIsExpanded(true);
            }}
            leftIcon={<Maximize2 className="h-3.5 w-3.5" />}
          >
            Expand
          </Button>
        )}
      </div>

      {showSearchBar ? (
        <div className="border-b border-stroke dark:border-dark-3 px-3 py-2">
          <SearchBar
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchValueChange}
            onSearch={onSearch}
            showButton
            isLoading={isLoading}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : hasResults ? (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                onClick={() => onToggleSelect(transaction.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  selectedIds.has(transaction.id)
                    ? "border-green/40 bg-green/10"
                    : transaction.id === recommendedTransactionId
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:border-stroke hover:bg-gray-1 dark:hover:border-dark-3 dark:hover:bg-dark-3"
                }`}
              >
                <div onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(transaction.id)}
                    onChange={() => onToggleSelect(transaction.id)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-xs text-dark-5 dark:text-dark-6">
                        {formatDate(transaction.date)}
                      </span>
                      {transaction.id === recommendedTransactionId && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Recommended
                        </span>
                      )}
                      {transaction.category && (
                        <span
                          className="truncate rounded px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${transaction.category.color}20`,
                            color: transaction.category.color,
                          }}
                        >
                          {transaction.category.name}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        transaction.amountIn && transaction.amountIn > 0
                          ? "text-green"
                          : "text-red"
                      }`}
                    >
                      {formatAmount(transaction.amountIn, transaction.amountOut)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-dark dark:text-white">
                    {transaction.label?.trim() || transaction.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-dark-5 dark:text-dark-6">
            {emptyMessage}
          </div>
        )}
      </div>

      {footerAction ? (
        <div className="border-t border-stroke px-3 py-2 dark:border-dark-3">
          {footerAction}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-stroke px-3 py-2 text-xs text-dark-5 dark:border-dark-3 dark:text-dark-6">
        <span>
          Showing {startItem} to {endItem} of {totalItems}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            {currentPage}/{totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-sm p-4">
          <div className="mx-auto h-full max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2 flex flex-col">
            <div className="border-b border-stroke dark:border-dark-3 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-dark dark:text-white">{title}</p>
                <p className="text-xs text-dark-5 dark:text-dark-6">
                  Expanded selector with full transaction cards and filters
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                leftIcon={<X className="h-4 w-4" />}
              >
                Close
              </Button>
            </div>

            <div className="border-b border-stroke dark:border-dark-3 p-3 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              <SearchBar
                placeholder={searchPlaceholder}
                value={expandedSearch}
                onChange={setExpandedSearch}
                onSearch={() => {
                  onSearchValueChange(expandedSearch);
                  onSearch();
                }}
                showButton
                isLoading={isLoading}
                className="lg:col-span-2"
              />
              <Select
                value={expandedType}
                onChange={(value) => setExpandedType(value as "all" | "in" | "out")}
                options={[
                  { value: "all", label: "All types" },
                  { value: "in", label: "In only" },
                  { value: "out", label: "Out only" },
                ]}
                className="w-full"
                buttonClassName="w-full"
              />
              <Select
                value={expandedCategory}
                onChange={setExpandedCategory}
                options={categoryOptions}
                className="w-full"
                buttonClassName="w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <DatePicker value={expandedDateFrom} onChange={setExpandedDateFrom} />
                <DatePicker value={expandedDateTo} onChange={setExpandedDateTo} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="flex h-full items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : filteredExpandedRows.length > 0 ? (
                filteredExpandedRows.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={toCardTransaction(transaction)}
                    selected={selectedIds.has(transaction.id)}
                    onToggleSelect={() => onToggleSelect(transaction.id)}
                    wrapText
                  />
                ))
              ) : (
                <div className="py-8 text-center text-sm text-dark-5 dark:text-dark-6">
                  {emptyMessage}
                </div>
              )}
            </div>

            <div className="border-t border-stroke dark:border-dark-3 px-3 py-2 flex items-center justify-between gap-2 text-xs text-dark-5 dark:text-dark-6">
              <span>
                Showing {startItem} to {endItem} of {totalItems}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  {currentPage}/{totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
