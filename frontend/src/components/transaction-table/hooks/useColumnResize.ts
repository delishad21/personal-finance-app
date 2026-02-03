import { useState, useRef, useCallback } from "react";
import { ColumnWidths, NEXT_COLUMN, MIN_COLUMN_WIDTH } from "../config/columns";

export function useColumnResize(defaultWidths: ColumnWidths) {
  const [columnWidths, setColumnWidths] = useState(defaultWidths);

  const resizingColumn = useRef<string | null>(null);
  const nextColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidthLeft = useRef<number>(0);
  const startWidthRight = useRef<number>(0);

  const handleResizeStart = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
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
    },
    [columnWidths],
  );

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

  return {
    columnWidths,
    handleResizeStart,
  };
}
