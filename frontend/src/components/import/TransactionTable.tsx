"use client";

import { useState, useCallback, useRef, Fragment } from "react";
import {
  CheckCircle,
  ArrowLeft,
  ArrowLeftToLine,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ResizableHeader } from "./ResizableHeader";

interface Transaction {
  date: string;
  description: string;
  label?: string;
  categoryId?: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  metadata: Record<string, any>;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface ParseResult {
  success: boolean;
  filename: string;
  parserId: string;
  transactions: Transaction[];
  count: number;
}

interface TransactionTableProps {
  parsedData: ParseResult;
  transactions: Transaction[];
  categories: Category[];
  accountNumber: string;
  onUpdateTransaction: (index: number, field: string, value: any) => void;
  onAccountNumberChange: (value: string) => void;
  onImport: () => void;
  onAddCategoryClick: () => void;
}

const DEFAULT_COLUMN_WIDTHS = {
  expand: 40,
  date: 140,
  label: 200,
  description: 350,
  category: 180,
  amountIn: 120,
  amountOut: 120,
};

const NEXT_COLUMN: Record<string, string | null> = {
  expand: "date",
  date: "label",
  label: "description",
  description: "category",
  category: "amountIn",
  amountIn: "amountOut",
  amountOut: null,
};

const MIN_COLUMN_WIDTH = 60;

export function TransactionTable({
  parsedData,
  transactions,
  categories,
  accountNumber,
  onUpdateTransaction,
  onAccountNumberChange,
  onImport,
  onAddCategoryClick,
}: TransactionTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);

  const resizingColumn = useRef<string | null>(null);
  const nextColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidthLeft = useRef<number>(0);
  const startWidthRight = useRef<number>(0);

  const toggleRowExpanded = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleCopyDescriptionToLabel = (index: number) => {
    onUpdateTransaction(index, "label", transactions[index].description);
  };

  const handleCopyAllDescriptionsToLabels = () => {
    transactions.forEach((transaction, index) => {
      onUpdateTransaction(index, "label", transaction.description);
    });
  };

  const handleResizeStart = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    const rightColumn = NEXT_COLUMN[columnKey];
    if (!rightColumn) return;

    resizingColumn.current = columnKey;
    nextColumn.current = rightColumn;
    startX.current = e.clientX;
    startWidthLeft.current =
      columnWidths[columnKey as keyof typeof columnWidths];
    startWidthRight.current =
      columnWidths[rightColumn as keyof typeof columnWidths];

    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn.current || !nextColumn.current) return;

    const diff = e.clientX - startX.current;

    let newLeftWidth = startWidthLeft.current + diff;
    let newRightWidth = startWidthRight.current - diff;

    if (newLeftWidth < MIN_COLUMN_WIDTH) {
      newLeftWidth = MIN_COLUMN_WIDTH;
      newRightWidth =
        startWidthLeft.current + startWidthRight.current - MIN_COLUMN_WIDTH;
    }
    if (newRightWidth < MIN_COLUMN_WIDTH) {
      newRightWidth = MIN_COLUMN_WIDTH;
      newLeftWidth =
        startWidthLeft.current + startWidthRight.current - MIN_COLUMN_WIDTH;
    }

    setColumnWidths((prev) => ({
      ...prev,
      [resizingColumn.current!]: newLeftWidth,
      [nextColumn.current!]: newRightWidth,
    }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingColumn.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 py-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green" />
              <span className="font-semibold text-dark dark:text-white">
                {parsedData.count} Transactions
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
            <TextInput
              label="Account Number:"
              size="sm"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              placeholder="Enter account number"
            />
            <Button
              variant="success"
              onClick={onImport}
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              Import All
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3">
        <table
          className="w-full border-collapse"
          style={{ tableLayout: "fixed" }}
        >
          <thead className="sticky top-0 z-10 bg-gray-1 dark:bg-dark-2">
            <tr className="border-b border-stroke dark:border-dark-3">
              <th
                className="py-3 px-2 font-medium text-dark dark:text-white"
                style={{ width: columnWidths.expand }}
              ></th>
              <ResizableHeader
                columnKey="date"
                columnWidth={columnWidths.date}
                onResizeStart={handleResizeStart}
              >
                Date
              </ResizableHeader>
              <ResizableHeader
                columnKey="label"
                columnWidth={columnWidths.label}
                onResizeStart={handleResizeStart}
              >
                <div className="flex items-center gap-2">
                  Label
                  <button
                    onClick={handleCopyAllDescriptionsToLabels}
                    className="p-1 hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
                    title="Copy all descriptions to labels"
                  >
                    <ArrowLeftToLine className="h-3.5 w-3.5 text-primary" />
                  </button>
                </div>
              </ResizableHeader>
              <ResizableHeader
                columnKey="description"
                columnWidth={columnWidths.description}
                onResizeStart={handleResizeStart}
              >
                Description
              </ResizableHeader>
              <ResizableHeader
                columnKey="category"
                columnWidth={columnWidths.category}
                onResizeStart={handleResizeStart}
              >
                Category
              </ResizableHeader>
              <ResizableHeader
                columnKey="amountIn"
                columnWidth={columnWidths.amountIn}
                align="right"
                onResizeStart={handleResizeStart}
              >
                In
              </ResizableHeader>
              <ResizableHeader
                columnKey="amountOut"
                columnWidth={columnWidths.amountOut}
                align="right"
                resizable={false}
              >
                Out
              </ResizableHeader>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <Fragment key={`transaction-${index}`}>
                <tr className="border-b border-stroke dark:border-dark-3 hover:bg-gray-1 dark:hover:bg-dark-3/50 transition-colors group">
                  <td
                    className="py-0 px-2"
                    style={{ width: columnWidths.expand }}
                  >
                    <button
                      onClick={() => toggleRowExpanded(index)}
                      className="p-1 hover:bg-gray-2 dark:hover:bg-dark-3 rounded"
                    >
                      {expandedRows.has(index) ? (
                        <ChevronDown className="h-4 w-4 text-dark-5 dark:text-dark-6" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-dark-5 dark:text-dark-6" />
                      )}
                    </button>
                  </td>

                  <td
                    className="py-0 px-0"
                    style={{ width: columnWidths.date }}
                  >
                    <DatePicker
                      value={transaction.date}
                      onChange={(date) =>
                        onUpdateTransaction(index, "date", date)
                      }
                    />
                  </td>

                  <td
                    className="py-0 px-0"
                    style={{ width: columnWidths.label }}
                  >
                    <div className="flex items-center h-full">
                      <input
                        type="text"
                        value={transaction.label || ""}
                        onChange={(e) =>
                          onUpdateTransaction(index, "label", e.target.value)
                        }
                        placeholder="Add label..."
                        className="flex-1 h-full px-3 py-3 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                      />
                      <button
                        onClick={() => handleCopyDescriptionToLabel(index)}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-opacity"
                        title="Copy description to label"
                      >
                        <ArrowLeft className="h-3.5 w-3.5 text-dark-5 dark:text-dark-6" />
                      </button>
                    </div>
                  </td>

                  <td
                    className="py-0 px-0"
                    style={{ width: columnWidths.description }}
                  >
                    <input
                      type="text"
                      value={transaction.description}
                      onChange={(e) =>
                        onUpdateTransaction(
                          index,
                          "description",
                          e.target.value,
                        )
                      }
                      className="w-full h-full px-3 py-3 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                    />
                  </td>

                  <td
                    className="py-0 px-0"
                    style={{ width: columnWidths.category }}
                  >
                    <CategorySelect
                      value={transaction.categoryId}
                      categories={categories}
                      onChange={(categoryId) =>
                        onUpdateTransaction(index, "categoryId", categoryId)
                      }
                      onAddClick={onAddCategoryClick}
                    />
                  </td>

                  <td
                    className="py-0 px-0"
                    style={{ width: columnWidths.amountIn }}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={transaction.amountIn || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateTransaction(
                          index,
                          "amountIn",
                          val ? parseFloat(val) || 0 : undefined,
                        );
                      }}
                      placeholder="-"
                      className="w-full h-full px-3 py-3 text-sm text-right border-0 bg-transparent text-green font-medium outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                    />
                  </td>

                  <td
                    className="py-0 px-0"
                    style={{ width: columnWidths.amountOut }}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={transaction.amountOut || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateTransaction(
                          index,
                          "amountOut",
                          val ? parseFloat(val) || 0 : undefined,
                        );
                      }}
                      placeholder="-"
                      className="w-full h-full px-3 py-3 text-sm text-right border-0 bg-transparent text-red font-medium outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                    />
                  </td>
                </tr>

                {expandedRows.has(index) && (
                  <tr className="border-b border-stroke dark:border-dark-3 bg-gray-1 dark:bg-dark-3/30">
                    <td colSpan={7} className="py-3 px-4">
                      <div className="text-sm space-y-1 pl-8">
                        <div className="font-medium text-dark dark:text-white mb-2">
                          Raw Data
                        </div>
                        {Object.entries(transaction.metadata).map(
                          ([key, value]) => (
                            <div
                              key={key}
                              className="flex gap-2 text-dark-5 dark:text-dark-6"
                            >
                              <span className="font-medium capitalize">
                                {key.replace(/([A-Z])/g, " $1").trim()}:
                              </span>
                              <span className="text-dark dark:text-white">
                                {JSON.stringify(value)}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
