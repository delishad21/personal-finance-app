"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowLeftRight, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TransactionLinkage } from "@/components/transaction-table/types";

interface TransactionMoreOptionsProps {
  index: number;
  linkage: TransactionLinkage | null;
  onLinkageChange: (index: number, linkage: TransactionLinkage | null) => void;
  onSelectReimbursement: (index: number) => void;
  disabled?: boolean;
  linkedCount?: number;
}

export function TransactionMoreOptions({
  index,
  linkage,
  onLinkageChange,
  onSelectReimbursement,
  disabled = false,
  linkedCount = 0,
}: TransactionMoreOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(
    linkage?.autoDetected === true || linkage !== null,
  );

  const handleMarkInternal = () => {
    if (linkage?.type === "internal") {
      onLinkageChange(index, null);
    } else {
      onLinkageChange(index, {
        type: "internal",
        autoDetected: false,
      });
    }
  };

  const handleMarkReimbursement = () => {
    if (linkage?.type === "reimbursement") {
      onLinkageChange(index, null);
    } else {
      onSelectReimbursement(index);
    }
  };

  const handleClearLinkage = () => {
    onLinkageChange(index, null);
  };

  return (
    <tr className="bg-gray-1/50 dark:bg-dark-3/30">
      <td colSpan={8} className="p-0">
        {/* Toggle Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-dark-5 dark:text-dark-6 hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
          disabled={disabled}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span>More Options</span>
          {linkage && (
            <span
              className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                linkage.type === "internal"
                  ? "bg-gray-2 dark:bg-dark-3 text-dark-5 dark:text-dark-6"
                  : "bg-green/10 text-green dark:text-green-light"
              }`}
            >
              {linkage.type === "internal" ? "Internal" : "Reimbursement"}
              {linkage.autoDetected && " (Auto)"}
            </span>
          )}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 py-3 border-t border-stroke dark:border-dark-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={linkage?.type === "internal" ? "primary" : "secondary"}
                size="sm"
                onClick={handleMarkInternal}
                disabled={disabled}
                leftIcon={<ArrowLeftRight className="w-4 h-4" />}
              >
                {linkage?.type === "internal"
                  ? "Marked as Internal"
                  : "Mark as Internal"}
              </Button>

              <Button
                variant={
                  linkage?.type === "reimbursement" ? "primary" : "secondary"
                }
                size="sm"
                onClick={handleMarkReimbursement}
                disabled={disabled || linkage?.type === "internal"}
                leftIcon={<Receipt className="w-4 h-4" />}
                className={
                  linkage?.type === "reimbursement"
                    ? "!bg-green hover:!bg-green/90"
                    : ""
                }
              >
                {linkage?.type === "reimbursement"
                  ? `Reimbursement (${linkedCount} linked)`
                  : "Mark as Reimbursement"}
              </Button>

              {linkage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearLinkage}
                  disabled={disabled}
                  leftIcon={<X className="w-4 h-4" />}
                  className="text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white"
                >
                  Clear
                </Button>
              )}
            </div>

            {linkage?.autoDetected && (
              <p className="mt-2 text-xs text-dark-5 dark:text-dark-6">
                Auto-detected: {linkage.detectionReason}
              </p>
            )}

            {linkage?.type === "reimbursement" && linkedCount > 0 && (
              <p className="mt-2 text-sm text-dark dark:text-white">
                This transaction reimburses{" "}
                <span className="font-medium">{linkedCount}</span> transaction
                {linkedCount !== 1 ? "s" : ""}.
              </p>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
