import { ArrowLeftRight, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Transaction, TransactionLinkage } from "./types";

interface TransactionRowExpandedProps {
  transaction: Transaction;
  colSpan: number;
  linkage?: TransactionLinkage | null;
  showOptions?: boolean;
  disabled?: boolean;
  linkedCount?: number;
  onLinkageChange?: (linkage: TransactionLinkage | null) => void;
  onSelectReimbursement?: () => void;
}

export function TransactionRowExpanded({
  transaction,
  colSpan,
  linkage,
  showOptions = false,
  disabled = false,
  linkedCount = 0,
  onLinkageChange,
  onSelectReimbursement,
}: TransactionRowExpandedProps) {
  const handleMarkInternal = () => {
    if (!onLinkageChange) return;
    if (linkage?.type === "internal") {
      onLinkageChange(null);
    } else {
      onLinkageChange({
        type: "internal",
        autoDetected: false,
      });
    }
  };

  const handleMarkReimbursement = () => {
    if (linkage?.type === "reimbursement") {
      onLinkageChange?.(null);
    } else {
      onSelectReimbursement?.();
    }
  };

  const handleClearLinkage = () => {
    onLinkageChange?.(null);
  };

  return (
    <tr className="border-b border-stroke dark:border-dark-3 bg-gray-1 dark:bg-dark-3/30">
      <td colSpan={colSpan} className="py-3 px-4">
        <div className="text-sm pl-8">
          {showOptions && (
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-dark dark:text-white">
                  Linkage
                </span>
                {linkage && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      linkage.type === "internal"
                        ? "bg-gray-2 dark:bg-dark-3 text-dark-5 dark:text-dark-6"
                        : "bg-green/10 text-green dark:text-green-light"
                    }`}
                  >
                    {linkage.type === "internal" ? "Internal" : "Reimbursement"}
                    {linkage.autoDetected && " (Auto)"}
                  </span>
                )}
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

                {linkage?.autoDetected && (
                  <span className="text-xs text-dark-5 dark:text-dark-6">
                    Auto-detected: {linkage.detectionReason}
                  </span>
                )}
              </div>

              {linkage?.type === "reimbursement" && linkedCount > 0 && (
                <p className="mt-2 text-sm text-dark dark:text-white">
                  This transaction reimburses{" "}
                  <span className="font-medium">{linkedCount}</span> transaction
                  {linkedCount !== 1 ? "s" : ""}.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <div className="font-medium text-dark dark:text-white mb-2">
              Raw Data
            </div>
            {Object.entries(transaction.metadata).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-dark-5 dark:text-dark-6">
                <span className="font-medium capitalize min-w-[120px]">
                  {key}:
                </span>
                <span className="break-all">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}
