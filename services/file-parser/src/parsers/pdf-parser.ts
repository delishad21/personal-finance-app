import pdfParse from "pdf-parse";

interface PDFParserConfig {
  patterns?: {
    transactionBlock?: string;
    transactionLine?: string;
  };
  fieldExtractors?: {
    date?: { group: number; format?: string };
    description?: { group: number; trim?: boolean };
    amount?: { group: number; type?: string };
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

export async function parsePDF(
  buffer: Buffer,
  parserId: string,
  config?: PDFParserConfig,
): Promise<Transaction[]> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text;

    // Basic PDF parsing - extract transactions from text
    // This is a simple implementation - you'll need to customize based on actual PDF formats
    const lines = text.split("\n");
    const transactions: Transaction[] = [];

    // Simple pattern matching (this is very basic - needs customization per bank)
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
    const amountPattern = /\$?[\d,]+\.\d{2}/g;

    let currentTransaction: Partial<Transaction> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Try to find date
      const dateMatch = trimmedLine.match(datePattern);
      if (dateMatch) {
        // If we have a previous transaction, save it
        if (currentTransaction.date) {
          transactions.push(currentTransaction as Transaction);
          currentTransaction = {};
        }
        currentTransaction.date = dateMatch[1];
      }

      // Try to find amounts
      const amounts = trimmedLine.match(amountPattern);
      if (amounts && currentTransaction.date) {
        // Simple heuristic: last amount is usually the balance
        if (amounts.length >= 2) {
          const amount = parseFloat(amounts[0].replace(/[$,]/g, ""));
          if (amount > 0) {
            currentTransaction.amountIn = amount;
          } else {
            currentTransaction.amountOut = Math.abs(amount);
          }
          currentTransaction.balance = parseFloat(
            amounts[amounts.length - 1].replace(/[$,]/g, ""),
          );
        }
      }

      // Description is everything else
      if (currentTransaction.date && !currentTransaction.description) {
        currentTransaction.description = trimmedLine
          .replace(datePattern, "")
          .trim();
      }
    }

    // Add last transaction
    if (currentTransaction.date) {
      transactions.push(currentTransaction as Transaction);
    }

    // Add metadata
    return transactions.map((t) => ({
      ...t,
      metadata: {
        source: "pdf",
        parserId,
      },
    }));
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error("Failed to parse PDF");
  }
}
