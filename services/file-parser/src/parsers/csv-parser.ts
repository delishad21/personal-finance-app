import Papa from "papaparse";
import { format, parse } from "date-fns";

interface CSVParserConfig {
  delimiter?: string;
  hasHeader?: boolean;
  dateFormat?: string;
  columnMapping: {
    date: string;
    description: string;
    amountIn?: string;
    amountOut?: string;
    amount?: string;
    balance?: string;
    [key: string]: string | undefined;
  };
  amountTransform?: {
    type: "single_column_signed" | "separate_columns";
    column?: string;
  };
}

interface Transaction {
  date: string;
  description: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  metadata: Record<string, any>;
}

export async function parseCSV(
  buffer: Buffer,
  parserId: string,
  config?: CSVParserConfig,
): Promise<Transaction[]> {
  const csvText = buffer.toString("utf-8");

  // Default config
  const parserConfig: CSVParserConfig = config || {
    delimiter: ",",
    hasHeader: true,
    dateFormat: "MM/dd/yyyy",
    columnMapping: {
      date: "Date",
      description: "Description",
      amountIn: "Credit",
      amountOut: "Debit",
      balance: "Balance",
    },
  };

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: parserConfig.hasHeader,
      delimiter: parserConfig.delimiter,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions = results.data.map((row: any) => {
            // Parse date
            let date = row[parserConfig.columnMapping.date];
            if (parserConfig.dateFormat) {
              try {
                const parsedDate = parse(
                  date,
                  parserConfig.dateFormat,
                  new Date(),
                );
                date = format(parsedDate, "yyyy-MM-dd");
              } catch (e) {
                // Keep original if parsing fails
              }
            }

            // Parse amounts
            let amountIn: number | undefined;
            let amountOut: number | undefined;

            if (parserConfig.amountTransform?.type === "single_column_signed") {
              const amountStr =
                row[parserConfig.amountTransform.column || "Amount"];
              const amount = parseFloat(amountStr.replace(/[,$]/g, ""));
              if (amount > 0) {
                amountIn = amount;
              } else if (amount < 0) {
                amountOut = Math.abs(amount);
              }
            } else {
              // Separate columns
              if (parserConfig.columnMapping.amountIn) {
                const inStr = row[parserConfig.columnMapping.amountIn];
                if (inStr) {
                  amountIn = parseFloat(inStr.replace(/[,$]/g, ""));
                }
              }
              if (parserConfig.columnMapping.amountOut) {
                const outStr = row[parserConfig.columnMapping.amountOut];
                if (outStr) {
                  amountOut = parseFloat(outStr.replace(/[,$]/g, ""));
                }
              }
            }

            // Parse balance
            let balance: number | undefined;
            if (parserConfig.columnMapping.balance) {
              const balanceStr = row[parserConfig.columnMapping.balance];
              if (balanceStr) {
                balance = parseFloat(balanceStr.replace(/[,$]/g, ""));
              }
            }

            // Get description
            const description =
              row[parserConfig.columnMapping.description] || "";

            // Store all other fields as metadata
            const metadata: Record<string, any> = {};
            Object.keys(row).forEach((key) => {
              if (
                key !== parserConfig.columnMapping.date &&
                key !== parserConfig.columnMapping.description &&
                key !== parserConfig.columnMapping.amountIn &&
                key !== parserConfig.columnMapping.amountOut &&
                key !== parserConfig.columnMapping.balance
              ) {
                metadata[key] = row[key];
              }
            });

            return {
              date,
              description,
              amountIn,
              amountOut,
              balance,
              metadata,
            };
          });

          resolve(transactions.filter((t) => t.date && t.description));
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}
