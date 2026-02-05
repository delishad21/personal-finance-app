"use client";

import { useState, Fragment } from "react";
import {
  ArrowLeft,
  ArrowLeftToLine,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Checkbox } from "@/components/ui/Checkbox";
import { ResizableHeader } from "./ResizableHeader";
import { TransactionTableToolbar } from "./TransactionTableToolbar";
import { DuplicateWarningBanner } from "./DuplicateWarningBanner";
import { TransactionRowExpanded } from "./TransactionRowExpanded";
import { DuplicateMatchList } from "./DuplicateMatchList";
import { useColumnResize } from "./hooks/useColumnResize";
import { DEFAULT_COLUMN_WIDTHS, MIN_COLUMN_WIDTHS } from "./config/columns";
import type { TransactionTableProps } from "./types";

export function TransactionTable({
  parsedData,
  transactions,
  categories,
  accountIdentifier,
  accountColor,
  duplicates,
  selectedIndices,
  nonDuplicateIndices = new Set(),
  isCheckingDuplicates,
  isImporting,
  showDuplicatesOnly = false,
  onUpdateTransaction,
  onAccountIdentifierChange,
  onAccountColorChange,
  onImport,
  onConfirmImport,
  onSelectAll,
  onDeselectAll,
  onToggleSelection,
  onAddCategoryClick,
  onBack,
}: TransactionTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const { columnWidths, handleResizeStart } = useColumnResize(
    DEFAULT_COLUMN_WIDTHS,
  );

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

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TransactionTableToolbar
        parsedData={parsedData}
        accountIdentifier={accountIdentifier}
        accountColor={accountColor}
        selectedCount={selectedIndices?.size || 0}
        totalCount={transactions.length}
        duplicateCount={duplicates?.size || 0}
        showDuplicatesOnly={showDuplicatesOnly}
        isCheckingDuplicates={isCheckingDuplicates || false}
        isImporting={isImporting || false}
        onBack={onBack}
        onImport={onImport}
        onConfirmImport={onConfirmImport}
        onAccountIdentifierChange={onAccountIdentifierChange}
        onAccountColorChange={onAccountColorChange}
      />

      {showDuplicatesOnly && duplicates && duplicates.size > 0 && (
        <DuplicateWarningBanner
          duplicateCount={duplicates.size}
          nonDuplicateCount={nonDuplicateIndices.size}
        />
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3">
        <table
          className="w-full border-collapse"
          style={{ tableLayout: "fixed" }}
        >
          <thead className="sticky top-0 z-10 bg-gray-1 dark:bg-dark-2">
            <tr className="border-b border-stroke dark:border-dark-3">
              {/* Checkbox column */}
              <th
                className="py-3 px-4 font-medium text-dark dark:text-white"
                style={{ width: columnWidths.checkbox }}
              >
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={
                      selectedIndices?.size === transactions.length &&
                      transactions.length > 0
                    }
                    indeterminate={
                      (selectedIndices?.size || 0) > 0 &&
                      selectedIndices?.size !== transactions.length
                    }
                    onChange={(checked) => {
                      if (checked) {
                        onSelectAll?.();
                      } else {
                        onDeselectAll?.();
                      }
                    }}
                  />
                </div>
              </th>
              <th
                className="py-3 px-2 font-medium text-dark dark:text-white"
                style={{ width: columnWidths.expand }}
              ></th>
              <ResizableHeader
                columnKey="date"
                columnWidth={columnWidths.date}
                minWidth={MIN_COLUMN_WIDTHS.date}
                onResizeStart={handleResizeStart}
              >
                Date
              </ResizableHeader>
              <ResizableHeader
                columnKey="label"
                columnWidth={columnWidths.label}
                minWidth={MIN_COLUMN_WIDTHS.label}
                onResizeStart={handleResizeStart}
              >
                <div className="flex items-center gap-2">
                  Label
                  {!showDuplicatesOnly && (
                    <button
                      onClick={handleCopyAllDescriptionsToLabels}
                      className="p-1 hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
                      title="Copy all descriptions to labels"
                    >
                      <ArrowLeftToLine className="h-3.5 w-3.5 text-primary" />
                    </button>
                  )}
                </div>
              </ResizableHeader>
              <ResizableHeader
                columnKey="description"
                columnWidth={columnWidths.description}
                minWidth={MIN_COLUMN_WIDTHS.description}
                onResizeStart={handleResizeStart}
              >
                Description
              </ResizableHeader>
              <ResizableHeader
                columnKey="category"
                columnWidth={columnWidths.category}
                minWidth={MIN_COLUMN_WIDTHS.category}
                onResizeStart={handleResizeStart}
              >
                Category
              </ResizableHeader>
              <ResizableHeader
                columnKey="amountIn"
                columnWidth={columnWidths.amountIn}
                minWidth={MIN_COLUMN_WIDTHS.amountIn}
                onResizeStart={handleResizeStart}
              >
                In
              </ResizableHeader>
              <ResizableHeader
                columnKey="amountOut"
                columnWidth={columnWidths.amountOut}
                minWidth={MIN_COLUMN_WIDTHS.amountOut}
                resizable={false}
              >
                Out
              </ResizableHeader>
            </tr>
          </thead>
          <tbody>
            {transactions
              .map((transaction, index) => ({ transaction, index }))
              .filter(({ index }) =>
                showDuplicatesOnly ? duplicates?.has(index) : true,
              )
              .map(({ transaction, index }) => {
                const rowDuplicates = duplicates?.get(index);
                const hasDuplicates = rowDuplicates && rowDuplicates.length > 0;
                const isSelected = selectedIndices?.has(index);

                return (
                  <Fragment key={`transaction-${index}`}>
                    <tr
                      className={`border-b hover:bg-gray-1 dark:hover:bg-dark-3/50 transition-colors group ${
                        hasDuplicates
                          ? "border-2 border-red dark:border-red-light"
                          : "border-stroke dark:border-dark-3"
                      }`}
                    >
                      {/* Checkbox column */}
                      <td
                        className="py-0 px-4"
                        style={{ width: columnWidths.checkbox }}
                      >
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected || false}
                            onChange={() => onToggleSelection?.(index)}
                          />
                        </div>
                      </td>

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
                          disabled={showDuplicatesOnly}
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
                              onUpdateTransaction(
                                index,
                                "label",
                                e.target.value,
                              )
                            }
                            placeholder="Add label..."
                            disabled={showDuplicatesOnly}
                            className="flex-1 h-full px-3 py-3 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-not-allowed"
                          />
                          {!showDuplicatesOnly && (
                            <button
                              onClick={() =>
                                handleCopyDescriptionToLabel(index)
                              }
                              className="p-2 opacity-0 group-hover:opacity-100 hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-opacity"
                              title="Copy description to label"
                            >
                              <ArrowLeft className="h-3.5 w-3.5 text-dark-5 dark:text-dark-6" />
                            </button>
                          )}
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
                          disabled={showDuplicatesOnly}
                          className="w-full h-full px-3 py-3 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-not-allowed"
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
                          disabled={showDuplicatesOnly}
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
                          disabled={showDuplicatesOnly}
                          className="w-full h-full px-3 py-3 text-sm border-0 bg-transparent text-green font-medium outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-not-allowed"
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
                          disabled={showDuplicatesOnly}
                          className="w-full h-full px-3 py-3 text-sm border-0 bg-transparent text-red font-medium outline-none focus:ring-2 focus:ring-inset focus:ring-primary disabled:cursor-not-allowed"
                        />
                      </td>
                    </tr>

                    {expandedRows.has(index) && (
                      <TransactionRowExpanded
                        transaction={transaction}
                        colSpan={8}
                      />
                    )}

                    {hasDuplicates && (
                      <DuplicateMatchList matches={rowDuplicates} colSpan={8} />
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
