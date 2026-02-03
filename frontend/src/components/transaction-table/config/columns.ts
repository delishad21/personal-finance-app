export const DEFAULT_COLUMN_WIDTHS = {
  checkbox: 50,
  expand: 40,
  date: 140,
  label: 200,
  description: 350,
  category: 180,
  amountIn: 120,
  amountOut: 120,
} as const;

export const NEXT_COLUMN: Record<string, string | null> = {
  checkbox: "expand",
  expand: "date",
  date: "label",
  label: "description",
  description: "category",
  category: "amountIn",
  amountIn: "amountOut",
  amountOut: null,
};

export const MIN_COLUMN_WIDTH = 60;

export type ColumnWidths = typeof DEFAULT_COLUMN_WIDTHS;
