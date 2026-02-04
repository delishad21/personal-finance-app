import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ParseResult } from "./types";

interface TransactionTableToolbarProps {
  parsedData: ParseResult;
  accountNumber: string;
  selectedCount: number;
  totalCount: number;
  duplicateCount: number;
  showDuplicatesOnly: boolean;
  isCheckingDuplicates: boolean;
  isImporting: boolean;
  onBack?: () => void;
  onImport: () => void;
  onConfirmImport?: () => void;
  onAccountNumberChange: (value: string) => void;
}

export function TransactionTableToolbar({
  parsedData,
  accountNumber,
  selectedCount,
  totalCount,
  duplicateCount,
  showDuplicatesOnly,
  isCheckingDuplicates,
  isImporting,
  onBack,
  onImport,
  onConfirmImport,
  onAccountNumberChange,
}: TransactionTableToolbarProps) {
  return (
    <div className="flex-shrink-0 py-3 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="secondary" size="sm" onClick={onBack}>
              ← Back
            </Button>
          )}
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green" />
            <span className="font-semibold text-dark dark:text-white">
              {showDuplicatesOnly
                ? `${duplicateCount} Potential Duplicate${duplicateCount !== 1 ? "s" : ""}`
                : `${totalCount} Transaction${totalCount !== 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="h-6 w-px bg-stroke dark:bg-dark-3" />
          <div className="text-sm text-dark-5 dark:text-dark-6">
            <span className="font-medium text-dark dark:text-white">
              {parsedData.filename}
            </span>
            <span className="mx-2 text-dark-5">•</span>
            <span>{parsedData.parserId}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!showDuplicatesOnly && (
            <TextInput
              label="Account Number:"
              size="sm"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              placeholder="Enter account number"
            />
          )}

          {showDuplicatesOnly ? (
            /* Duplicate handling stage */
            <div className="flex items-center gap-2">
              <span className="text-sm text-orange-dark dark:text-orange-light font-medium">
                {selectedCount} selected to import
              </span>
              <Button
                variant="success"
                onClick={onConfirmImport}
                disabled={isImporting}
                leftIcon={<CheckCircle className="h-4 w-4" />}
              >
                {isImporting ? "Importing..." : "Import All"}
              </Button>
            </div>
          ) : (
            /* Review stage */
            <Button
              variant="success"
              onClick={onImport}
              disabled={isCheckingDuplicates || selectedCount === 0}
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              {isCheckingDuplicates
                ? "Checking..."
                : `Import Selected (${selectedCount})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
