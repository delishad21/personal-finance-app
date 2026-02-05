"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  compact = false,
  leftContent,
  rightContent,
  className = "",
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    // Show pages around current
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1 && !leftContent && !rightContent) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${
        compact
          ? "px-0 py-0"
          : "bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 px-4 py-3"
      } ${className}`}
    >
      {leftContent && <div className="flex items-center">{leftContent}</div>}

      {rightContent && <div className="flex items-center">{rightContent}</div>}

      {/* Page Numbers */}
      <div className="flex items-center gap-3 ml-auto">
        <div className="text-sm text-dark-5 dark:text-dark-6 text-right">
          Showing{" "}
          <span className="font-medium text-dark dark:text-white">
            {startItem}
          </span>{" "}
          to{" "}
          <span className="font-medium text-dark dark:text-white">
            {endItem}
          </span>{" "}
          of{" "}
          <span className="font-medium text-dark dark:text-white">
            {totalItems}
          </span>{" "}
          transactions
        </div>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-full border border-stroke dark:border-dark-3 text-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            compact ? "bg-transparent" : "bg-white dark:bg-dark-2"
          }`}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page, index) => {
          if (page === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-dark-5 dark:text-dark-6"
              >
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-full border text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-primary border-primary text-white"
                  : "border-stroke dark:border-dark-3 text-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-3"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-full border border-stroke dark:border-dark-3 text-dark dark:text-white hover:bg-gray-2 dark:hover:bg-dark-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            compact ? "bg-transparent" : "bg-white dark:bg-dark-2"
          }`}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
