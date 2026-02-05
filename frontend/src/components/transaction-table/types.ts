export interface TransactionLinkage {
  type: "internal" | "reimbursement" | "reimbursed";
  reimburses?: string[]; // Transaction IDs this transaction reimburses
  reimbursedBy?: string[]; // Transaction IDs that reimburse this transaction
  autoDetected?: boolean; // True if parser detected
  detectionReason?: string; // Why it was detected
  _pendingBatchIndices?: number[]; // Temp: batch indices (resolved on commit)
}

export interface Transaction {
  date: string;
  description: string;
  label?: string;
  categoryId?: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  accountIdentifier?: string;
  accountNumber?: string; // Account number extracted from statement (for import detection)
  linkage?: TransactionLinkage | null;
  metadata: Record<string, any>;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface AccountIdentifier {
  id: string;
  accountIdentifier: string;
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
  accountIdentifier: string;
  accountColor?: string;
  accountIdentifiers: AccountIdentifier[];
  isNewAccount?: boolean;
  duplicates?: Map<number, DuplicateMatch[]>;
  selectedIndices?: Set<number>;
  nonDuplicateIndices?: Set<number>;
  isCheckingDuplicates?: boolean;
  isImporting?: boolean;
  showDuplicatesOnly?: boolean;
  onUpdateTransaction: (index: number, field: string, value: any) => void;
  onAccountIdentifierChange: (value: string) => void;
  onAccountColorChange?: (color: string) => void;
  onAddAccountIdentifier?: () => void;
  onImport: () => void;
  onConfirmImport?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onToggleSelection?: (index: number) => void;
  onAddCategoryClick: () => void;
  onBack?: () => void;
  onLinkageChange?: (index: number, linkage: TransactionLinkage | null) => void;
  onOpenReimbursementSelector?: (index: number) => void;
}
