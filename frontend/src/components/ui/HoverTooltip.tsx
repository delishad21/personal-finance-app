"use client";

import { ReactNode } from "react";

interface HoverTooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  widthClassName?: string;
}

export function HoverTooltip({
  children,
  content,
  side = "top",
  align = "center",
  widthClassName = "min-w-[220px] max-w-[320px]",
}: HoverTooltipProps) {
  const sideClass =
    side === "top"
      ? align === "start"
        ? "left-0 bottom-full mb-2"
        : align === "end"
          ? "right-0 bottom-full mb-2"
          : "left-1/2 -translate-x-1/2 bottom-full mb-2"
      : align === "start"
        ? "left-0 top-full mt-2"
        : align === "end"
          ? "right-0 top-full mt-2"
          : "left-1/2 -translate-x-1/2 top-full mt-2";

  return (
    <span className="relative inline-flex items-center group/tooltip">
      {children}
      <span
        className={`pointer-events-none absolute z-50 hidden ${sideClass} ${widthClassName} rounded-lg border border-stroke bg-dark px-3 py-2 text-xs text-white shadow-dropdown group-hover/tooltip:block group-focus-within/tooltip:block dark:border-dark-3 dark:bg-dark-2`}
      >
        {content}
      </span>
    </span>
  );
}

