"use client";

import { useState, Fragment, useRef, useCallback, useEffect, memo } from "react";
import type { KeyboardEvent, FormEvent } from "react";
import {
  ArrowRight,
  ArrowRightToLine,
  ChevronRight,
  ChevronDown,
  Filter,
  X,
} from "lucide-react";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Checkbox } from "@/components/ui/Checkbox";
import { SearchBar } from "@/components/ui/SearchBar";
import { Select } from "@/components/ui/Select";
import { HoverTooltip } from "@/components/ui/HoverTooltip";
import { ResizableHeader } from "./ResizableHeader";
import { TransactionTableToolbar } from "./TransactionTableToolbar";
import { DuplicateWarningBanner } from "./DuplicateWarningBanner";
import { TransactionRowExpanded } from "./TransactionRowExpanded";
import { DuplicateMatchList } from "./DuplicateMatchList";
import { useColumnResize } from "./hooks/useColumnResize";
import { DEFAULT_COLUMN_WIDTHS, MIN_COLUMN_WIDTHS } from "./config/columns";
import type { TransactionTableProps } from "./types";

interface DeferredTextInputProps {
  value: string;
  disabled?: boolean;
  className: string;
  placeholder?: string;
  dataRow: string;
  dataCol: string;
  onCommit: (value: string) => void;
}

const DeferredTextInput = memo(function DeferredTextInput({
  value,
  disabled,
  className,
  placeholder,
  dataRow,
  dataCol,
  onCommit,
}: DeferredTextInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      placeholder={placeholder}
      disabled={disabled}
      data-row={dataRow}
      data-col={dataCol}
      className={className}
    />
  );
});

interface DeferredDecimalInputProps {
  value: number | null | undefined;
  disabled?: boolean;
  className: string;
  placeholder?: string;
  dataRow: string;
  dataCol: string;
  onCommit: (value: number | undefined) => void;
}

const DeferredDecimalInput = memo(function DeferredDecimalInput({
  value,
  disabled,
  className,
  placeholder,
  dataRow,
  dataCol,
  onCommit,
}: DeferredDecimalInputProps) {
  const valueString = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(valueString);

  useEffect(() => {
    setDraft(valueString);
  }, [valueString]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === valueString) return;
        const parsed = draft ? parseFloat(draft) || 0 : undefined;
        onCommit(parsed);
      }}
      placeholder={placeholder}
      disabled={disabled}
      data-row={dataRow}
      data-col={dataCol}
      className={className}
    />
  );
});

interface DeferredTextareaProps {
  value: string;
  disabled?: boolean;
  className: string;
  dataRow: string;
  dataCol: string;
  onInput?: (event: FormEvent<HTMLTextAreaElement>) => void;
  onCommit: (value: string) => void;
}

const DeferredTextarea = memo(function DeferredTextarea({
  value,
  disabled,
  className,
  dataRow,
  dataCol,
  onInput,
  onCommit,
}: DeferredTextareaProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onInput={onInput}
      disabled={disabled}
      rows={1}
      data-row={dataRow}
      data-col={dataCol}
      className={className}
    />
  );
});

export function TransactionTable({
  parsedData,
  transactions,
  categories,
  accountIdentifier,
  accountColor,
  accountIdentifiers,
  isNewAccount = false,
  duplicates,
  selectedIndices,
  nonDuplicateIndices = new Set(),
  isCheckingDuplicates,
  isImporting,
  showDuplicatesOnly = false,
  showAccountSelector = true,
  onUpdateTransaction,
  onAccountIdentifierChange,
  onAccountColorChange,
  onAddAccountIdentifier,
  onImport,
  onConfirmImport,
  onSelectAll,
  onDeselectAll,
  onSelectVisible,
  onDeselectVisible,
  onToggleSelection,
  onAddCategoryClick,
  onBack,
  onLinkageChange,
  onOpenReimbursementSelector,
  amountInHeader = "In",
  amountOutHeader = "Out",
  deferCellCommit = false,
  lockLinkedReimbursements = true,
  renderExpandedActions,
  reviewActionLeft,
}: TransactionTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [tableCategoryFilter, setTableCategoryFilter] = useState("");
  const [tableTypeFilter, setTableTypeFilter] = useState<
    "all" | "in" | "out"
  >("all");
  const [tableSuggestionFilter, setTableSuggestionFilter] = useState<
    "all" | "suggested" | "auto" | "unresolved"
  >("all");
  const [tableDateFrom, setTableDateFrom] = useState("");
  const [tableDateTo, setTableDateTo] = useState("");
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { columnWidths, handleResizeStart } = useColumnResize(
    DEFAULT_COLUMN_WIDTHS,
  );
  const internalCategory = categories.find(
    (category) => category.name === "Internal",
  );
  const reimbursementCategory = categories.find(
    (category) => category.name === "Reimbursement",
  );
  const displayCategories = [
    ...categories,
    ...(internalCategory
      ? []
      : [
          {
            id: "__internal__",
            name: "Internal",
            color: "#9ca3af",
          },
        ]),
    ...(reimbursementCategory
      ? []
      : [
          {
            id: "__reimbursement__",
            name: "Reimbursement",
            color: "#22c55e",
          },
        ]),
    {
      id: "__funding_in__",
      name: "Funding In",
      color: "#22c55e",
    },
  ];
  const isTripParser =
    parsedData?.parserId === "revolut_statement" ||
    parsedData?.parserId === "youtrip_statement";

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

  const autoResizeTextarea = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      const el = event.currentTarget;
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    },
    [],
  );

  const resizeVisibleDescriptionRows = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    const textareas = container.querySelectorAll<HTMLTextAreaElement>(
      'textarea[data-col="description"]',
    );
    textareas.forEach((el) => {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(resizeVisibleDescriptionRows);
    return () => cancelAnimationFrame(raf);
  }, [
    resizeVisibleDescriptionRows,
    transactions.length,
    showDuplicatesOnly,
    tableSearch,
    tableCategoryFilter,
    tableTypeFilter,
    tableSuggestionFilter,
    tableDateFrom,
    tableDateTo,
  ]);

  useEffect(() => {
    const triggerResize = () => {
      requestAnimationFrame(resizeVisibleDescriptionRows);
    };

    window.addEventListener("resize", triggerResize);

    const container = tableContainerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(triggerResize);
      observer.observe(container);
    }

    return () => {
      window.removeEventListener("resize", triggerResize);
      observer?.disconnect();
    };
  }, [resizeVisibleDescriptionRows]);

  const baseVisibleRows = transactions
    .map((transaction, index) => ({ transaction, index }))
    .filter(({ index }) =>
      showDuplicatesOnly ? duplicates?.has(index) : true,
    );

  const visibleRows = baseVisibleRows.filter(({ transaction }) => {
    const searchLower = tableSearch.trim().toLowerCase();
    const matchesSearch =
      searchLower.length === 0 ||
      transaction.description.toLowerCase().includes(searchLower) ||
      (transaction.label || "").toLowerCase().includes(searchLower);

    const matchesCategory =
      !tableCategoryFilter || transaction.categoryId === tableCategoryFilter;

    const amountIn = Number(transaction.amountIn || 0);
    const amountOut = Number(transaction.amountOut || 0);
    const matchesType =
      tableTypeFilter === "all" ||
      (tableTypeFilter === "in" && amountIn > 0) ||
      (tableTypeFilter === "out" && amountOut > 0);

    const hasSuggestion =
      !!transaction.suggestionSource &&
      Number(transaction.suggestionConfidence || 0) > 0;
    const isAutoApplied = transaction.suggestionApplied === true;
    const matchesSuggestion =
      tableSuggestionFilter === "all" ||
      (tableSuggestionFilter === "suggested" && hasSuggestion) ||
      (tableSuggestionFilter === "auto" && isAutoApplied) ||
      (tableSuggestionFilter === "unresolved" &&
        !isAutoApplied &&
        !transaction.categoryId &&
        !transaction.label &&
        !transaction.linkage);

    const txDate = transaction.date || "";
    const matchesDateFrom = !tableDateFrom || txDate >= tableDateFrom;
    const matchesDateTo = !tableDateTo || txDate <= tableDateTo;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesType &&
      matchesSuggestion &&
      matchesDateFrom &&
      matchesDateTo
    );
  });

  const visibleIndices = visibleRows.map(({ index }) => index);
  const selectedVisibleCount = visibleIndices.filter((index) =>
    selectedIndices?.has(index),
  ).length;
  const allVisibleSelected =
    visibleIndices.length > 0 && selectedVisibleCount === visibleIndices.length;
  const partiallyVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleIndices.length;

  const handleTableKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const target = event.target as HTMLElement;
    const rowAttr = target.getAttribute("data-row");
    const colAttr = target.getAttribute("data-col");
    if (!rowAttr || !colAttr) return;

    event.preventDefault();
    const currentRow = Number(rowAttr);
    const direction = event.shiftKey ? -1 : 1;

    let nextRow = currentRow + direction;
    while (nextRow >= 0 && nextRow < visibleRows.length) {
      const nextEl = tableContainerRef.current?.querySelector<HTMLElement>(
        `[data-row="${nextRow}"][data-col="${colAttr}"]`,
      );
      if (nextEl) {
        const isDisabled =
          nextEl instanceof HTMLInputElement ||
          nextEl instanceof HTMLButtonElement
            ? nextEl.disabled
            : nextEl.getAttribute("aria-disabled") === "true";
        if (!isDisabled) {
          nextEl.focus();
          break;
        }
      }
      nextRow += direction;
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 overflow-hidden">
      <TransactionTableToolbar
        parsedData={parsedData}
        accountIdentifier={accountIdentifier}
        accountColor={accountColor}
        accountIdentifiers={accountIdentifiers}
        isNewAccount={isNewAccount}
        selectedCount={selectedIndices?.size || 0}
        totalCount={transactions.length}
        duplicateCount={duplicates?.size || 0}
        showDuplicatesOnly={showDuplicatesOnly}
        showAccountSelector={showAccountSelector}
        isCheckingDuplicates={isCheckingDuplicates || false}
        isImporting={isImporting || false}
        onBack={onBack}
        onImport={onImport}
        onConfirmImport={onConfirmImport}
        onAccountIdentifierChange={onAccountIdentifierChange}
        onAccountColorChange={onAccountColorChange}
        onAddAccountIdentifier={onAddAccountIdentifier}
        reviewActionLeft={reviewActionLeft}
      />

      {showDuplicatesOnly && duplicates && duplicates.size > 0 && (
        <DuplicateWarningBanner
          duplicateCount={duplicates.size}
          nonDuplicateCount={nonDuplicateIndices.size}
        />
      )}

      {/* Table */}
      <div
        ref={tableContainerRef}
        onKeyDown={handleTableKeyDown}
        className="flex-1 min-h-0 overflow-auto bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3"
      >
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
                    checked={allVisibleSelected}
                    indeterminate={partiallyVisibleSelected}
                    onChange={(checked) => {
                      if (checked) {
                        if (onSelectVisible) {
                          onSelectVisible(visibleIndices);
                        } else {
                          onSelectAll?.();
                        }
                      } else {
                        if (onDeselectVisible) {
                          onDeselectVisible(visibleIndices);
                        } else {
                          onDeselectAll?.();
                        }
                      }
                    }}
                  />
                </div>
              </th>
              <th
                className="py-3 px-2 font-medium text-dark dark:text-white relative"
                style={{ width: columnWidths.expand }}
              >
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                    className="p-1 rounded hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
                    title="Table filters"
                  >
                    <Filter className="h-4 w-4" />
                  </button>
                </div>
                {isFilterMenuOpen && (
                  <div className="absolute left-2 top-11 z-30 w-[300px] rounded-lg border border-stroke bg-white p-3 shadow-card dark:border-dark-3 dark:bg-dark-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                        Filter rows
                      </p>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-gray-2 dark:hover:bg-dark-3"
                        onClick={() => setIsFilterMenuOpen(false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <SearchBar
                        value={tableSearch}
                        onChange={setTableSearch}
                        placeholder="Search description or label"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-11 rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2">
                          <DatePicker
                            value={tableDateFrom}
                            onChange={setTableDateFrom}
                            className="h-full"
                          />
                        </div>
                        <div className="h-11 rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2">
                          <DatePicker
                            value={tableDateTo}
                            onChange={setTableDateTo}
                            className="h-full"
                          />
                        </div>
                      </div>
                      <Select
                        value={tableCategoryFilter}
                        onChange={setTableCategoryFilter}
                        options={[
                          { value: "", label: "All categories" },
                          ...displayCategories.map((category) => ({
                            value: category.id,
                            label: category.name,
                          })),
                        ]}
                        className="w-full"
                        buttonClassName="w-full"
                        menuPlacement="down"
                      />
                      <Select
                        value={tableTypeFilter}
                        onChange={(value) =>
                          setTableTypeFilter(value as "all" | "in" | "out")
                        }
                        options={[
                          { value: "all", label: "All types" },
                          { value: "in", label: "In only" },
                          { value: "out", label: "Out only" },
                        ]}
                        className="w-full"
                        buttonClassName="w-full"
                        menuPlacement="down"
                      />
                      <Select
                        value={tableSuggestionFilter}
                        onChange={(value) =>
                          setTableSuggestionFilter(
                            value as "all" | "suggested" | "auto" | "unresolved",
                          )
                        }
                        options={[
                          { value: "all", label: "All suggestion states" },
                          { value: "suggested", label: "Suggested" },
                          { value: "auto", label: "Auto-applied" },
                          { value: "unresolved", label: "Unresolved" },
                        ]}
                        className="w-full"
                        buttonClassName="w-full"
                        menuPlacement="down"
                      />
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => {
                          setTableSearch("");
                          setTableCategoryFilter("");
                          setTableTypeFilter("all");
                          setTableSuggestionFilter("all");
                          setTableDateFrom("");
                          setTableDateTo("");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  </div>
                )}
              </th>
              <ResizableHeader
                columnKey="date"
                columnWidth={columnWidths.date}
                minWidth={MIN_COLUMN_WIDTHS.date}
                onResizeStart={handleResizeStart}
              >
                Date
              </ResizableHeader>
              <ResizableHeader
                columnKey="description"
                columnWidth={columnWidths.description}
                minWidth={MIN_COLUMN_WIDTHS.description}
                onResizeStart={handleResizeStart}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>Description</span>
                  {!showDuplicatesOnly && (
                    <button
                      onClick={handleCopyAllDescriptionsToLabels}
                      className="p-1 hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
                      title="Copy all descriptions to labels"
                    >
                      <ArrowRightToLine className="h-3.5 w-3.5 text-primary" />
                    </button>
                  )}
                </div>
              </ResizableHeader>
              <ResizableHeader
                columnKey="label"
                columnWidth={columnWidths.label}
                minWidth={MIN_COLUMN_WIDTHS.label}
                onResizeStart={handleResizeStart}
              >
                Label
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
                {amountInHeader}
              </ResizableHeader>
              <ResizableHeader
                columnKey="amountOut"
                columnWidth={columnWidths.amountOut}
                minWidth={MIN_COLUMN_WIDTHS.amountOut}
                resizable={false}
              >
                {amountOutHeader}
              </ResizableHeader>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ transaction, index }, visibleIndex) => {
              const rowDuplicates = duplicates?.get(index);
              const hasDuplicates = rowDuplicates && rowDuplicates.length > 0;
              const isSelected = selectedIndices?.has(index);

              const internalCategoryId = internalCategory?.id ?? "__internal__";
              const reimbursementCategoryId =
                reimbursementCategory?.id ?? "__reimbursement__";
              const linkageType = transaction.linkage?.type;
              const transactionType = String(
                transaction.metadata?.transactionType || "",
              ).toLowerCase();
              const metadata =
                transaction.metadata && typeof transaction.metadata === "object"
                  ? (transaction.metadata as Record<string, unknown>)
                  : {};
              const fundingInDisabled = metadata.fundingInDisabled === true;
              const isFundingInTopup =
                isTripParser &&
                (transaction.entryTypeOverride === "funding_in" ||
                  (transactionType === "topup" && !fundingInDisabled));
              const displayCategoryId =
                linkageType === "internal"
                  ? internalCategoryId
                  : linkageType === "reimbursement"
                    ? reimbursementCategoryId
                    : isFundingInTopup
                      ? "__funding_in__"
                      : transaction.categoryId;
              const isReimbursementLinkage =
                linkageType === "reimbursement" || linkageType === "reimbursed";
              const isLockedByLinkage =
                !!linkageType &&
                (!isReimbursementLinkage || lockLinkedReimbursements);
              const hasSuggestionMetadata = !!transaction.suggestionSource;
              const suggestionConfidencePct = Math.round(
                Number(transaction.suggestionConfidence || 0) * 100,
              );
              const suggestionReason = String(
                (transaction.metadata as Record<string, unknown>)?.suggestionReason || "",
              ).trim();
              const labelMatchesSuggestion =
                !!transaction.suggestedLabel &&
                String(transaction.label || "").trim().toLowerCase() ===
                  String(transaction.suggestedLabel || "")
                    .trim()
                    .toLowerCase();
              const categoryMatchesSuggestion =
                !!transaction.suggestedCategoryId &&
                String(displayCategoryId || "") ===
                  String(transaction.suggestedCategoryId || "");
              const suggestionTooltipBlock = (
                fieldLabel: "Label" | "Category",
                suggestedValue?: string,
              ) => (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Suggested
                  </div>
                  {hasSuggestionMetadata && (
                    <>
                      <div>
                        <span className="text-dark-6">Source:</span>{" "}
                        <span className="font-medium text-white">
                          {transaction.suggestionSource}
                        </span>
                      </div>
                      <div>
                        <span className="text-dark-6">Confidence:</span>{" "}
                        <span className="font-medium text-white">
                          {suggestionConfidencePct}%
                        </span>
                      </div>
                      <div>
                        <span className="text-dark-6">Status:</span>{" "}
                        <span className="font-medium text-white">
                          {transaction.suggestionApplied
                            ? "Auto-applied"
                            : "Suggested only"}
                        </span>
                      </div>
                    </>
                  )}
                  {suggestedValue && (
                    <div>
                      <span className="text-dark-6">{fieldLabel}:</span>{" "}
                      <span className="font-medium text-white">{suggestedValue}</span>
                    </div>
                  )}
                  {suggestionReason && (
                    <div className="leading-relaxed">
                      <span className="text-dark-6">Reason:</span>{" "}
                      <span className="text-white">{suggestionReason}</span>
                    </div>
                  )}
                </div>
              );

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
                      <div className="flex min-h-[44px] items-center justify-center">
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
                      </div>
                    </td>

                    <td
                      className="py-0 px-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary"
                      style={{ width: columnWidths.date }}
                    >
                      <div className="w-full h-full min-h-[44px] flex items-stretch">
                        <DatePicker
                          value={transaction.date}
                          onChange={(date) =>
                            onUpdateTransaction(index, "date", date)
                          }
                          disabled={showDuplicatesOnly}
                          triggerProps={{
                            "data-row": `${visibleIndex}`,
                            "data-col": "date",
                            className:
                              "py-2 min-h-[44px] items-center hover:bg-transparent dark:hover:bg-transparent",
                          }}
                        />
                      </div>
                    </td>

                    <td
                      className="py-0 px-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary"
                      style={{ width: columnWidths.description }}
                    >
                      <div className="relative w-full h-full min-h-[44px] flex items-stretch">
                        {deferCellCommit ? (
                          <DeferredTextarea
                            value={transaction.description}
                            onCommit={(nextValue) =>
                              onUpdateTransaction(index, "description", nextValue)
                            }
                            onInput={autoResizeTextarea}
                            disabled={showDuplicatesOnly}
                            dataRow={`${visibleIndex}`}
                            dataCol="description"
                            className="w-full h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-0 resize-none disabled:cursor-not-allowed"
                          />
                        ) : (
                          <textarea
                            value={transaction.description}
                            onChange={(e) =>
                              onUpdateTransaction(
                                index,
                                "description",
                                e.target.value,
                              )
                            }
                            onInput={autoResizeTextarea}
                            disabled={showDuplicatesOnly}
                            rows={1}
                            data-row={`${visibleIndex}`}
                            data-col="description"
                            className="w-full h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-0 resize-none disabled:cursor-not-allowed"
                          />
                        )}
                        {!showDuplicatesOnly && (
                          <button
                            onClick={() => handleCopyDescriptionToLabel(index)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-opacity"
                            title="Copy description to label"
                          >
                            <ArrowRight className="h-3.5 w-3.5 text-dark-5 dark:text-dark-6" />
                          </button>
                        )}
                      </div>
                    </td>

                    <td
                      className="py-0 px-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary"
                      style={{ width: columnWidths.label }}
                    >
                      <div className="relative w-full flex items-stretch h-full min-h-[44px]">
                        {deferCellCommit ? (
                          <DeferredTextInput
                            value={transaction.label || ""}
                            onCommit={(nextValue) =>
                              onUpdateTransaction(index, "label", nextValue)
                            }
                            placeholder="Add label..."
                            disabled={showDuplicatesOnly}
                            dataRow={`${visibleIndex}`}
                            dataCol="label"
                            className={`flex-1 h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-0 disabled:cursor-not-allowed ${
                              labelMatchesSuggestion ? "pr-8" : ""
                            }`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={transaction.label || ""}
                            onChange={(e) =>
                              onUpdateTransaction(index, "label", e.target.value)
                            }
                            placeholder="Add label..."
                            disabled={showDuplicatesOnly}
                            data-row={`${visibleIndex}`}
                            data-col="label"
                            className={`flex-1 h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-dark dark:text-white outline-none focus:ring-0 disabled:cursor-not-allowed ${
                              labelMatchesSuggestion ? "pr-8" : ""
                            }`}
                          />
                        )}
                        {labelMatchesSuggestion && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2">
                            <HoverTooltip
                              content={suggestionTooltipBlock(
                                "Label",
                                transaction.suggestedLabel,
                              )}
                              align="end"
                            >
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-sm font-bold leading-none text-primary">
                                *
                              </span>
                            </HoverTooltip>
                          </span>
                        )}
                      </div>
                    </td>

                    <td
                      className="py-0 px-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary"
                      style={{ width: columnWidths.category }}
                    >
                      <div className="w-full h-full min-h-[44px] flex items-stretch">
                        <CategorySelect
                          value={displayCategoryId}
                          categories={displayCategories}
                          onChange={(categoryId) =>
                            onUpdateTransaction(index, "categoryId", categoryId)
                          }
                          onAddClick={onAddCategoryClick}
                          variant="borderless"
                          excludeReserved={!transaction.linkage}
                          dropdownPlacement="inline"
                          disabled={
                            showDuplicatesOnly ||
                            isLockedByLinkage ||
                            isFundingInTopup
                          }
                          lockedByLinkage={isLockedByLinkage || isFundingInTopup}
                          showOpenRing={false}
                          suggestionMarker={{
                            show: categoryMatchesSuggestion,
                            tooltipContent: suggestionTooltipBlock(
                              "Category",
                              transaction.suggestedCategoryId,
                            ),
                          }}
                          triggerProps={{
                            "data-row": `${visibleIndex}`,
                            "data-col": "category",
                            className:
                              "py-2 min-h-[44px] items-center hover:bg-transparent dark:hover:bg-transparent",
                          }}
                        />
                      </div>
                    </td>

                    <td
                      className="py-0 px-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary"
                      style={{ width: columnWidths.amountIn }}
                    >
                      <div className="w-full h-full min-h-[44px] flex items-stretch">
                        {deferCellCommit ? (
                          <DeferredDecimalInput
                            value={transaction.amountIn ?? undefined}
                            onCommit={(nextValue) =>
                              onUpdateTransaction(index, "amountIn", nextValue)
                            }
                            placeholder="-"
                            disabled={showDuplicatesOnly}
                            dataRow={`${visibleIndex}`}
                            dataCol="amountIn"
                            className="w-full h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-green font-medium outline-none focus:ring-0 disabled:cursor-not-allowed"
                          />
                        ) : (
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
                            data-row={`${visibleIndex}`}
                            data-col="amountIn"
                            className="w-full h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-green font-medium outline-none focus:ring-0 disabled:cursor-not-allowed"
                          />
                        )}
                      </div>
                    </td>

                    <td
                      className="py-0 px-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary"
                      style={{ width: columnWidths.amountOut }}
                    >
                      <div className="w-full h-full min-h-[44px] flex items-stretch">
                        {deferCellCommit ? (
                          <DeferredDecimalInput
                            value={transaction.amountOut ?? undefined}
                            onCommit={(nextValue) =>
                              onUpdateTransaction(index, "amountOut", nextValue)
                            }
                            placeholder="-"
                            disabled={showDuplicatesOnly}
                            dataRow={`${visibleIndex}`}
                            dataCol="amountOut"
                            className="w-full h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-red font-medium outline-none focus:ring-0 disabled:cursor-not-allowed"
                          />
                        ) : (
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
                            data-row={`${visibleIndex}`}
                            data-col="amountOut"
                            className="w-full h-full min-h-[44px] px-3 py-2 text-sm border-0 bg-transparent text-red font-medium outline-none focus:ring-0 disabled:cursor-not-allowed"
                          />
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedRows.has(index) && (
                    <TransactionRowExpanded
                      transaction={transaction}
                      colSpan={8}
                      linkage={transaction.linkage || null}
                      showOptions={!showDuplicatesOnly && !!onLinkageChange}
                      disabled={isImporting}
                      linkedCount={
                        transaction.linkage?.reimbursesAllocations?.length || 0
                      }
                      renderExpandedActions={
                        renderExpandedActions
                          ? () => renderExpandedActions(index, transaction)
                          : undefined
                      }
                      onLinkageChange={
                        onLinkageChange
                          ? (linkage) => onLinkageChange(index, linkage)
                          : undefined
                      }
                      onSelectReimbursement={
                        onOpenReimbursementSelector
                          ? () => onOpenReimbursementSelector(index)
                          : undefined
                      }
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
