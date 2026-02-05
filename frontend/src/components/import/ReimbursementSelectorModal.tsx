"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Checkbox } from "@/components/ui/Checkbox";
import { Transaction, TransactionLinkage } from "@/components/transaction-table/types";
import { searchTransactionsForReimbursement } from "@/app/actions/transactions";

interface DatabaseTransaction {
  id: string;
  date: string;
  description: string;
  amountIn: number | null;
  amountOut: number | null;
  category?: {
    name: string;
    color: string;
  };
}

interface ReimbursementSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (linkage: TransactionLinkage) => void;
  currentIndex: number;
  transactions: Transaction[];
  currentLinkage?: TransactionLinkage | null;
}

export function ReimbursementSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  currentIndex,
  transactions,
  currentLinkage,
}: ReimbursementSelectorModalProps) {
  // Selected batch indices (other transactions in import)
  const [selectedBatchIndices, setSelectedBatchIndices] = useState<Set<number>>(
    new Set(currentLinkage?._pendingBatchIndices || [])
  );
  // Selected database transaction IDs
  const [selectedDbIds, setSelectedDbIds] = useState<Set<string>>(
    new Set(currentLinkage?.reimburses || [])
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DatabaseTransaction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedBatchIndices(
        new Set(currentLinkage?._pendingBatchIndices || [])
      );
      setSelectedDbIds(new Set(currentLinkage?.reimburses || []));
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [isOpen, currentLinkage]);

  // Search database transactions
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await searchTransactionsForReimbursement(searchQuery, 20);
      setSearchResults(results.transactions || []);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Toggle batch selection
  const toggleBatchSelection = (index: number) => {
    setSelectedBatchIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Toggle database selection
  const toggleDbSelection = (id: string) => {
    setSelectedDbIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Confirm selection
  const handleConfirm = () => {
    const linkage: TransactionLinkage = {
      type: "reimbursement",
      reimburses: Array.from(selectedDbIds),
      _pendingBatchIndices: Array.from(selectedBatchIndices),
    };
    onConfirm(linkage);
    onClose();
  };

  // Get selectable batch transactions (exclude current and any that are already marked as reimbursement)
  const selectableBatchTransactions = transactions
    .map((t, i) => ({ ...t, index: i }))
    .filter(
      (t) =>
        t.index !== currentIndex &&
        t.linkage?.type !== "reimbursement"
    );

  const totalSelected = selectedBatchIndices.size + selectedDbIds.size;

  if (!isOpen) return null;

  const formatAmount = (amountIn?: number | null, amountOut?: number | null) => {
    if (amountIn && amountIn > 0) return `+$${amountIn.toFixed(2)}`;
    if (amountOut && amountOut > 0) return `-$${amountOut.toFixed(2)}`;
    return "$0.00";
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-dark-2 rounded-lg shadow-xl border border-stroke dark:border-dark-3 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Green accent line */}
        <div className="absolute left-0 top-0 h-full w-1 bg-green" />

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-stroke dark:border-dark-3">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-green" />
            <div>
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Select Transactions to Reimburse
              </h3>
              <p className="text-sm text-dark-5 dark:text-dark-6 mt-1">
                Choose which transactions this payment reimburses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg hover:bg-gray-1 dark:hover:bg-dark-3 transition-colors"
          >
            <X className="h-5 w-5 text-dark-5 dark:text-dark-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Batch Transactions Section */}
          {selectableBatchTransactions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-dark dark:text-white mb-3">
                From Current Import ({selectableBatchTransactions.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-stroke dark:border-dark-3 rounded-lg p-2">
                {selectableBatchTransactions.map((t) => (
                  <label
                    key={t.index}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedBatchIndices.has(t.index)
                        ? "bg-green/10 border border-green/30"
                        : "hover:bg-gray-1 dark:hover:bg-dark-3 border border-transparent"
                    }`}
                  >
                    <Checkbox
                      checked={selectedBatchIndices.has(t.index)}
                      onChange={() => toggleBatchSelection(t.index)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-dark-5 dark:text-dark-6">
                          {formatDate(t.date)}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            t.amountIn && t.amountIn > 0
                              ? "text-green"
                              : "text-red"
                          }`}
                        >
                          {formatAmount(t.amountIn, t.amountOut)}
                        </span>
                      </div>
                      <p className="text-sm text-dark dark:text-white truncate">
                        {t.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Database Search Section */}
          <div>
            <h4 className="text-sm font-medium text-dark dark:text-white mb-3">
              Search Existing Transactions
            </h4>
            <div className="flex gap-2 mb-3">
              <TextInput
                placeholder="Search by description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                leftIcon={<Search className="w-4 h-4" />}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Search Results */}
            {hasSearched && (
              <div className="border border-stroke dark:border-dark-3 rounded-lg p-2">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-center text-sm text-dark-5 dark:text-dark-6 py-8">
                    No transactions found
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((t) => (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedDbIds.has(t.id)
                            ? "bg-green/10 border border-green/30"
                            : "hover:bg-gray-1 dark:hover:bg-dark-3 border border-transparent"
                        }`}
                      >
                        <Checkbox
                          checked={selectedDbIds.has(t.id)}
                          onChange={() => toggleDbSelection(t.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-dark-5 dark:text-dark-6">
                                {formatDate(t.date)}
                              </span>
                              {t.category && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: `${t.category.color}20`,
                                    color: t.category.color,
                                  }}
                                >
                                  {t.category.name}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                t.amountIn && t.amountIn > 0
                                  ? "text-green"
                                  : "text-red"
                              }`}
                            >
                              {formatAmount(t.amountIn, t.amountOut)}
                            </span>
                          </div>
                          <p className="text-sm text-dark dark:text-white truncate">
                            {t.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!hasSearched && (
              <p className="text-center text-sm text-dark-5 dark:text-dark-6 py-4 border border-stroke dark:border-dark-3 rounded-lg">
                Enter a search term to find existing transactions
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stroke dark:border-dark-3 bg-gray-1/50 dark:bg-dark-3/30">
          <span className="text-sm text-dark-5 dark:text-dark-6">
            {totalSelected} transaction{totalSelected !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={totalSelected === 0}
              className="!bg-green hover:!bg-green/90"
            >
              Confirm Selection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
