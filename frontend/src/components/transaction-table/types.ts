export interface Transaction {
  date: string;
  description: string;
  label?: string;
  categoryId?: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  metadata: Record<string, any>;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface ParseResult {
  success: boolean;
  filename: string;
  parserId: string;
  transactions: Transaction[];
  count: number;
}

export interface DuplicateMatch {
  transaction: {
    id: string;
    date: Date;
    description: string;
    amountIn: number | null;
    amountOut: number | null;
    category?: {
      name: string;
      color: string;
    };
  };
  matchScore: number;
  matchReasons: string[];
}

export interface TransactionTableProps {
  parsedData: ParseResult;
  transactions: Transaction[];
  categories: Category[];
  accountNumber: string;
  duplicates?: Map<number, DuplicateMatch[]>;
  selectedIndices?: Set<number>;
  nonDuplicateIndices?: Set<number>;
  isCheckingDuplicates?: boolean;
  isImporting?: boolean;
  showDuplicatesOnly?: boolean;
  onUpdateTransaction: (index: number, field: string, value: any) => void;
  onAccountNumberChange: (value: string) => void;
  onImport: () => void;
  onConfirmImport?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onToggleSelection?: (index: number) => void;
  onAddCategoryClick: () => void;
  onBack?: () => void;
}
