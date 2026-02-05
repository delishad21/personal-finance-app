import { CheckCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ParseResult } from "./types";

interface TransactionTableToolbarProps {
  parsedData: ParseResult;
  accountIdentifier: string;
  accountColor?: string;
  selectedCount: number;
  totalCount: number;
  duplicateCount: number;
  showDuplicatesOnly: boolean;
  isCheckingDuplicates: boolean;
  isImporting: boolean;
  onBack?: () => void;
  onImport: () => void;
  onConfirmImport?: () => void;
  onAccountIdentifierChange: (value: string) => void;
  onAccountColorChange?: (color: string) => void;
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

export function TransactionTableToolbar({
  parsedData,
  accountIdentifier,
  accountColor = "#6366f1",
  selectedCount,
  totalCount,
  duplicateCount,
  showDuplicatesOnly,
  isCheckingDuplicates,
  isImporting,
  onBack,
  onImport,
  onConfirmImport,
  onAccountIdentifierChange,
  onAccountColorChange,
}: TransactionTableToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-dark dark:text-white whitespace-nowrap">
                Account Identifier:
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColorPicker((prev) => !prev)}
                  disabled={!accountIdentifier.trim()}
                  className="h-9 px-2 rounded-lg border border-stroke dark:border-dark-3 flex items-center gap-1 transition-colors hover:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Select account color"
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/70"
                    style={{ backgroundColor: accountColor }}
                  />
                  <span className="flex items-center justify-center w-4 text-dark-5 dark:text-dark-6">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </button>
                {showColorPicker && (
                  <div className="absolute right-0 top-full mt-2 p-2 w-52 rounded-lg border border-stroke dark:border-dark-3 bg-white dark:bg-dark-2 shadow-dropdown z-50">
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            onAccountColorChange?.(color);
                            setShowColorPicker(false);
                          }}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${
                            accountColor === color
                              ? "border-dark dark:border-white scale-105"
                              : "border-transparent hover:border-stroke dark:hover:border-dark-3"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <TextInput
                size="sm"
                value={accountIdentifier}
                onChange={(e) => onAccountIdentifierChange(e.target.value)}
                placeholder="Enter account identifier"
              />
            </div>
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
