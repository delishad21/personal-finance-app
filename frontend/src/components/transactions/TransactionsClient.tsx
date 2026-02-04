"use client";

import { useState } from "react";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { Pagination } from "@/components/transactions/Pagination";
import { Loader2, AlertCircle, Receipt } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { getTransactions } from "@/app/actions/transactions";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amountIn: number | null;
  amountOut: number | null;
  balance: number | null;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  metadata?: Record<string, any>;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface FilterValues {
  search: string;
  categoryIds: string[];
  month: string;
  year: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  transactionType: "all" | "income" | "expense";
  dateOrder: "desc" | "asc";
}

interface TransactionsClientProps {
  initialTransactions: Transaction[];
  initialTotal: number;
  initialTotalPages: number;
  categories: Category[];
  availableYears: number[];
}

export function TransactionsClient({
  initialTransactions,
  initialTotal,
  initialTotalPages,
  categories,
  availableYears,
}: TransactionsClientProps) {
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalItems, setTotalItems] = useState(initialTotal);
  const itemsPerPage = 20;

  // Filters
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    categoryIds: [],
    month: "",
    year: "",
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
    transactionType: "all",
    dateOrder: "desc",
  });

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const fetchTransactions = async (
    page: number,
    currentFilters: FilterValues,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * itemsPerPage;
      const data = await getTransactions({
        search: currentFilters.search || undefined,
        categoryIds:
          currentFilters.categoryIds.length > 0
            ? currentFilters.categoryIds
            : undefined,
        dateFrom: currentFilters.dateFrom
          ? new Date(currentFilters.dateFrom)
          : undefined,
        dateTo: currentFilters.dateTo
          ? new Date(currentFilters.dateTo)
          : undefined,
        minAmount: currentFilters.amountMin
          ? parseFloat(currentFilters.amountMin)
          : undefined,
        maxAmount: currentFilters.amountMax
          ? parseFloat(currentFilters.amountMax)
          : undefined,
        transactionType:
          currentFilters.transactionType !== "all"
            ? currentFilters.transactionType
            : undefined,
        dateOrder: currentFilters.dateOrder,
        limit: itemsPerPage,
        offset,
      });

      setTransactions(data.transactions || []);
      const total = data.total || 0;
      setTotalItems(total);
      setTotalPages(Math.max(1, Math.ceil(total / itemsPerPage)));
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load transactions",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCurrentPage(1);
    fetchTransactions(1, newFilters);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchTransactions(page, filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEdit = (transaction: Transaction) => {
    // TODO: Implement edit modal
    setModalState({
      isOpen: true,
      type: "info",
      title: "Edit Transaction",
      message: "Edit functionality will be implemented soon.",
    });
  };

  const handleDelete = (id: string) => {
    setModalState({
      isOpen: true,
      type: "warning",
      title: "Delete Transaction",
      message:
        "Are you sure you want to delete this transaction? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const response = await fetch(
            `http://localhost:4001/api/transactions/${id}`,
            {
              method: "DELETE",
              credentials: "include",
            },
          );

          if (!response.ok) {
            throw new Error("Failed to delete transaction");
          }

          // Refresh transactions
          setTransactions(transactions.filter((t) => t.id !== id));
          setTotalItems(totalItems - 1);

          setModalState({
            isOpen: true,
            type: "success",
            title: "Success",
            message: "Transaction deleted successfully.",
          });
        } catch (err) {
          setModalState({
            isOpen: true,
            type: "error",
            title: "Error",
            message:
              err instanceof Error
                ? err.message
                : "Failed to delete transaction",
          });
        }
      },
    });
  };

  // Group transactions by date
  const groupedTransactions = transactions.reduce(
    (groups, transaction) => {
      const date = new Date(transaction.date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    },
    {} as Record<string, Transaction[]>,
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <TransactionFilters
        categories={categories}
        availableYears={availableYears}
        onFilterChange={handleFilterChange}
        initialFilters={filters}
      />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-red-light-5 dark:bg-red/20 border border-red-light-3 dark:border-red-dark rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red dark:text-red-light-1 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-dark dark:text-red-light-2">
              Error Loading Transactions
            </h3>
            <p className="mt-1 text-sm text-red-dark dark:text-red-light-1">
              {error}
            </p>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 p-12 text-center">
          <Receipt className="w-16 h-16 text-dark-5 dark:text-dark-6 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-2">
            No transactions found
          </h3>
          <p className="text-dark-5 dark:text-dark-6">
            {filters.search ||
            filters.categoryIds.length > 0 ||
            filters.dateFrom ||
            filters.dateTo
              ? "Try adjusting your filters to see more results."
              : "Import your first transaction to get started."}
          </p>
        </div>
      ) : (
        <>
          {/* Pagination (Top) */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            compact
          />

          {/* Transaction List */}
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(
              ([date, dateTransactions]) => (
                <div key={date}>
                  {/* Date Header with line */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-dark dark:text-white whitespace-nowrap uppercase tracking-wide">
                      {date}
                    </h3>
                    <div className="flex-1 h-px bg-stroke dark:bg-dark-3"></div>
                  </div>

                  {/* Connected transaction block */}
                  <div className="overflow-hidden rounded-lg dark:border-dark-3">
                    {dateTransactions.map((transaction, index) => (
                      <div
                        key={transaction.id}
                        className={
                          index < dateTransactions.length - 1
                            ? "border-b border-stroke dark:border-dark-3"
                            : ""
                        }
                      >
                        <TransactionCard
                          transaction={transaction}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onConfirm={modalState.onConfirm}
      />
    </div>
  );
}
