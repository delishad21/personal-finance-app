import { Transaction } from "./types";

interface TransactionRowExpandedProps {
  transaction: Transaction;
  colSpan: number;
}

export function TransactionRowExpanded({
  transaction,
  colSpan,
}: TransactionRowExpandedProps) {
  return (
    <tr className="border-b border-stroke dark:border-dark-3 bg-gray-1 dark:bg-dark-3/30">
      <td colSpan={colSpan} className="py-3 px-4">
        <div className="text-sm space-y-1 pl-8">
          <div className="font-medium text-dark dark:text-white mb-2">
            Raw Data
          </div>
          {Object.entries(transaction.metadata).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-dark-5 dark:text-dark-6">
              <span className="font-medium capitalize min-w-[120px]">
                {key}:
              </span>
              <span className="break-all">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}
