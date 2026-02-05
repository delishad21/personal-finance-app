"use client";

interface ResizableHeaderProps {
  columnKey?: string;
  children: React.ReactNode;
  align?: "left" | "right";
  resizable?: boolean;
  flex?: boolean;
  columnWidth?: number;
  minWidth?: number;
  onResizeStart?: (columnKey: string, e: React.MouseEvent) => void;
}

export function ResizableHeader({
  columnKey,
  children,
  align = "left",
  resizable = true,
  flex = false,
  columnWidth,
  minWidth,
  onResizeStart,
}: ResizableHeaderProps) {
  return (
    <th
      className={`relative py-3 px-4 font-medium text-dark dark:text-white ${align === "right" ? "text-right" : "text-left"}`}
      style={{
        width: flex ? undefined : columnWidth,
        minWidth: flex ? 150 : minWidth ?? 60,
      }}
    >
      {children}
      {resizable && columnKey && onResizeStart && (
        <div
          className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center hover:bg-primary/20 transition-colors group"
          onMouseDown={(e) => onResizeStart(columnKey, e)}
        >
          <div className="w-0.5 h-4 bg-dark-5 dark:bg-dark-6 group-hover:bg-primary transition-colors" />
        </div>
      )}
    </th>
  );
}
