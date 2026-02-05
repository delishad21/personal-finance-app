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

export const MIN_COLUMN_WIDTHS: Record<keyof typeof DEFAULT_COLUMN_WIDTHS, number> = {
  checkbox: 40,
  expand: 32,
  date: 120,
  label: 160,
  description: 240,
  category: 140,
  amountIn: 110,
  amountOut: 110,
};

export type ColumnWidths = typeof DEFAULT_COLUMN_WIDTHS;
