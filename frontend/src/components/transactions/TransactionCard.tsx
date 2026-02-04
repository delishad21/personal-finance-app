"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  label?: string;
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

interface TransactionCardProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
}

export function TransactionCard({
  transaction,
  onEdit,
  onDelete,
}: TransactionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const amount = transaction.amountIn ?? transaction.amountOut ?? 0;
  const isIncome = transaction.amountIn !== null;

  return (
    <div
      className={`bg-white dark:bg-dark-2 transition-colors border ${
        isExpanded ? "border-primary" : "border-transparent"
      }`}
    >
      {/* Main Content */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="p-4 cursor-pointer hover:bg-gray-1 dark:hover:bg-dark-3/50"
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {transaction.category && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${transaction.category.color}20`,
                    color: transaction.category.color,
                  }}
                >
                  {transaction.category.name}
                </span>
              )}
            </div>
            <div className="font-medium text-dark dark:text-white truncate">
              {transaction.label && transaction.label.trim().length > 0
                ? transaction.label
                : transaction.description}
            </div>
            <div className="mt-0.5 text-xs text-dark-5 dark:text-dark-6 truncate">
              {transaction.description}
            </div>
          </div>

          {/* Right: Amount & Actions */}
          <div className="flex items-center gap-3">
            <div
              className={`text-lg font-semibold ${
                isIncome
                  ? "text-green dark:text-green-light"
                  : "text-red dark:text-red-light"
              }`}
            >
              {isIncome ? "+" : "-"}
              {formatAmount(Math.abs(amount))}
            </div>

            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(transaction);
                  }}
                  className="p-1.5 text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
                  title="Edit transaction"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(transaction.id);
                  }}
                  className="p-1.5 text-red hover:text-red dark:text-red hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
                  title="Delete transaction"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
          isExpanded ? "max-h-105 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-stroke dark:border-dark-3 bg-gray-1 dark:bg-dark-3/50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {transaction.balance !== null && (
              <div>
                <div className="text-dark-5 dark:text-dark-6">Balance</div>
                <div className="font-medium text-dark dark:text-white mt-0.5">
                  {formatAmount(transaction.balance)}
                </div>
              </div>
            )}

            {transaction.amountIn !== null && (
              <div>
                <div className="text-dark-5 dark:text-dark-6">Amount In</div>
                <div className="font-medium text-green dark:text-green-light mt-0.5">
                  {formatAmount(transaction.amountIn)}
                </div>
              </div>
            )}

            {transaction.amountOut !== null && (
              <div>
                <div className="text-dark-5 dark:text-dark-6">Amount Out</div>
                <div className="font-medium text-red dark:text-red-light mt-0.5">
                  {formatAmount(transaction.amountOut)}
                </div>
              </div>
            )}

            {transaction.metadata &&
              Object.keys(transaction.metadata).length > 0 && (
                <div className="col-span-2">
                  <div className="text-dark-5 dark:text-dark-6 mb-2">
                    Additional Details
                  </div>
                  <div className="bg-white dark:bg-dark-2 rounded border border-stroke dark:border-dark-3 p-3">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {Object.entries(transaction.metadata).map(
                        ([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <dt className="text-dark-5 dark:text-dark-6">
                              {key.replace(/([A-Z])/g, " $1").trim()}:
                            </dt>
                            <dd className="text-dark dark:text-white font-medium truncate">
                              {String(value)}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
