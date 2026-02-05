import { TransactionsClient } from "../../../components/transactions/TransactionsClient";
import {
  getTransactions,
  getTransactionYears,
} from "@/app/actions/transactions";
import { getCategories } from "@/app/actions/categories";
import { getAccountNumbers } from "@/app/actions/accountNumbers";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amountIn: number | null;
  amountOut: number | null;
  balance: number | null;
  accountIdentifier?: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  metadata?: Record<string, any>;
}

async function getInitialTransactions() {
  try {
    const itemsPerPage = 20;
    const data = await getTransactions({ limit: itemsPerPage, offset: 0 });
    const total = data.total || 0;
    return {
      transactions: data.transactions || [],
      total,
      totalPages: Math.max(1, Math.ceil(total / itemsPerPage)),
    };
  } catch (err) {
    console.error("Error fetching transactions:", err);
    return {
      transactions: [],
      total: 0,
      totalPages: 1,
    };
  }
}

export default async function TransactionsPage() {
  const [categories, accountNumbers, initialData, availableYears] =
    await Promise.all([
      getCategories(),
      getAccountNumbers(),
      getInitialTransactions(),
      getTransactionYears(),
    ]);

  return (
    <TransactionsClient
      initialTransactions={initialData.transactions}
      initialTotal={initialData.total}
      initialTotalPages={initialData.totalPages}
      categories={categories}
      accountNumbers={accountNumbers}
      availableYears={availableYears}
    />
  );
}
