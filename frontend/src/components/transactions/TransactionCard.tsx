"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  ArrowLeftRight,
  Receipt,
  Link2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";

interface TransactionLinkage {
  type: "internal" | "reimbursement" | "reimbursed";
  reimburses?: string[];
  reimbursedBy?: string[];
  autoDetected?: boolean;
  detectionReason?: string;
}

interface LinkedTransaction {
  id: string;
  date: string;
  description: string;
  amountIn: number | null;
  amountOut: number | null;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  label?: string;
  amountIn: number | null;
  amountOut: number | null;
  balance: number | null;
  accountIdentifier?: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  metadata?: Record<string, any>;
  linkage?: TransactionLinkage | null;
}

interface TransactionCardProps {
  transaction: Transaction;
  accountColor?: string;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  linkedTransactions?: {
    reimburses: LinkedTransaction[];
    reimbursedBy: LinkedTransaction[];
  };
}

export function TransactionCard({
  transaction,
  accountColor,
  onEdit,
  onDelete,
  selected = false,
  onToggleSelect,
  linkedTransactions,
}: TransactionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const linkageType = transaction.linkage?.type;
  const isInternal = linkageType === "internal";
  const isReimbursement = linkageType === "reimbursement";
  const isReimbursed = linkageType === "reimbursed";

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

  // Determine left border color based on linkage type
  const getLeftBorderColor = () => {
    if (isReimbursement) return "#22c55e"; // bright green for reimbursement
    if (isInternal) return "#9ca3af"; // gray for internal
    return accountColor;
  };

  return (
    <div
      className={`bg-white dark:bg-dark-2 transition-colors border ${
        isExpanded || selected ? "border-primary" : "border-transparent"
      } ${isInternal ? "opacity-70" : ""}`}
    >
      {/* Main Content */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="relative p-4 pl-6 cursor-pointer hover:bg-gray-1 dark:hover:bg-dark-3/50"
      >
        {(accountColor || isReimbursement || isInternal) && (
          <span
            className="absolute left-0 top-0 h-full w-1"
            style={{ backgroundColor: getLeftBorderColor() }}
          />
        )}
        <div className="flex items-start justify-between gap-4">
          {onToggleSelect && (
            <div className="pt-1" onClick={(event) => event.stopPropagation()}>
              <Checkbox checked={selected} onChange={onToggleSelect} />
            </div>
          )}
          {/* Left: Description */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-dark dark:text-white truncate">
              {transaction.label && transaction.label.trim().length > 0
                ? transaction.label
                : transaction.description}
            </div>
            <div className="mt-0.5 text-xs text-dark-5 dark:text-dark-6 truncate">
              {transaction.description}
            </div>
            {transaction.category && (
              <div className="mt-1 flex items-center gap-2 text-xs text-dark-5 dark:text-dark-6 truncate">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: transaction.category.color }}
                />
                <span>{transaction.category.name}</span>
              </div>
            )}
          </div>

          {/* Right: Amount & Actions */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              {/* Linkage badge */}
              {linkageType && (
                <div className="flex items-center gap-1 mb-1">
                  {isInternal && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-2 dark:bg-dark-3 text-dark-5 dark:text-dark-6">
                      <ArrowLeftRight className="w-3 h-3" />
                      Internal
                    </span>
                  )}
                  {isReimbursement && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green/10 text-green dark:text-green-light">
                      <Receipt className="w-3 h-3" />
                      Reimbursement
                    </span>
                  )}
                  {isReimbursed && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green/10 text-green dark:text-green-light">
                      <Link2 className="w-3 h-3" />
                      Reimbursed
                    </span>
                  )}
                </div>
              )}
              {/* Amount display */}
              <div
                className={`text-lg font-semibold ${
                  isInternal
                    ? "text-dark-5 dark:text-dark-6 line-through"
                    : isIncome
                      ? "text-green dark:text-green-light"
                      : "text-red dark:text-red-light"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatAmount(Math.abs(amount))}
              </div>
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
            <div>
              <div className="text-dark-5 dark:text-dark-6">Date</div>
              <div className="font-medium text-dark dark:text-white mt-0.5">
                {formatDate(transaction.date)}
              </div>
            </div>

            <div>
              <div className="text-dark-5 dark:text-dark-6">Label</div>
              <div className="font-medium text-dark dark:text-white mt-0.5">
                {transaction.label && transaction.label.trim().length > 0
                  ? transaction.label
                  : transaction.description}
              </div>
            </div>

            <div>
              <div className="text-dark-5 dark:text-dark-6">Description</div>
              <div className="font-medium text-dark dark:text-white mt-0.5">
                {transaction.description}
              </div>
            </div>

            {transaction.category && (
              <div>
                <div className="text-dark-5 dark:text-dark-6">Category</div>
                <div className="font-medium text-dark dark:text-white mt-0.5 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: transaction.category.color }}
                  />
                  <span>{transaction.category.name}</span>
                </div>
              </div>
            )}

            {transaction.accountIdentifier && (
              <div>
                <div className="text-dark-5 dark:text-dark-6">
                  Account Identifier
                </div>
                <div className="font-medium text-dark dark:text-white mt-0.5 flex items-center gap-2">
                  {accountColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: accountColor }}
                    />
                  )}
                  <span>{transaction.accountIdentifier}</span>
                </div>
              </div>
            )}

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

            {/* Linked Transactions Section */}
            {linkedTransactions &&
              (linkedTransactions.reimburses.length > 0 ||
                linkedTransactions.reimbursedBy.length > 0) && (
                <div className="col-span-2 mt-2">
                  {/* Reimburses Section */}
                  {linkedTransactions.reimburses.length > 0 && (
                    <div className="mb-3">
                      <div className="text-dark-5 dark:text-dark-6 mb-2 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-green" />
                        <span>
                          Reimburses ({linkedTransactions.reimburses.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {linkedTransactions.reimburses.map((linked) => (
                          <LinkedTransactionPreview
                            key={linked.id}
                            transaction={linked}
                            formatDate={formatDate}
                            formatAmount={formatAmount}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reimbursed By Section */}
                  {linkedTransactions.reimbursedBy.length > 0 && (
                    <div>
                      <div className="text-dark-5 dark:text-dark-6 mb-2 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-green" />
                        <span>
                          Reimbursed By (
                          {linkedTransactions.reimbursedBy.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {linkedTransactions.reimbursedBy.map((linked) => (
                          <LinkedTransactionPreview
                            key={linked.id}
                            transaction={linked}
                            formatDate={formatDate}
                            formatAmount={formatAmount}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for displaying linked transactions
function LinkedTransactionPreview({
  transaction,
  formatDate,
  formatAmount,
}: {
  transaction: LinkedTransaction;
  formatDate: (date: string) => string;
  formatAmount: (amount: number | null) => string;
}) {
  const amount = transaction.amountIn ?? transaction.amountOut ?? 0;
  const isIncome = transaction.amountIn !== null;

  return (
    <div className="flex items-center justify-between p-2 bg-white dark:bg-dark-2 rounded border border-stroke dark:border-dark-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-dark-5 dark:text-dark-6">
          {formatDate(transaction.date)}
        </div>
        <div className="text-sm text-dark dark:text-white truncate">
          {transaction.description}
        </div>
      </div>
      <div
        className={`text-sm font-medium ml-3 ${
          isIncome
            ? "text-green dark:text-green-light"
            : "text-red dark:text-red-light"
        }`}
      >
        {isIncome ? "+" : "-"}
        {formatAmount(Math.abs(amount))}
      </div>
    </div>
  );
}
