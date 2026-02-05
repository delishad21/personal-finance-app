"use server";

const PARSER_SERVICE_URL =
  process.env.PARSER_SERVICE_URL || "http://file-parser:4000";

interface TransactionLinkage {
  type: "internal" | "reimbursement" | "reimbursed";
  reimburses?: string[];
  reimbursedBy?: string[];
  autoDetected?: boolean;
  detectionReason?: string;
  _pendingBatchIndices?: number[];
}

interface ParseResult {
  success: boolean;
  filename: string;
  parserId: string;
  transactions: Array<{
    date: string;
    description: string;
    label?: string;
    amountIn?: number;
    amountOut?: number;
    balance?: number;
    accountIdentifier?: string;
    accountNumber?: string;
    metadata: Record<string, any>;
    linkage?: TransactionLinkage | null;
  }>;
  count: number;
}

export async function parseFile(formData: FormData): Promise<ParseResult> {
  try {
    const response = await fetch(`${PARSER_SERVICE_URL}/parse`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to parse file";
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.transactions) {
      throw new Error("Invalid response from parser service");
    }

    return result;
  } catch (error) {
    console.error("Parse file error:", error);
    throw error;
  }
}

export async function getAvailableParsers() {
  try {
    const response = await fetch(`${PARSER_SERVICE_URL}/parsers`);

    if (!response.ok) {
      throw new Error("Failed to fetch parsers");
    }

    const result = await response.json();
    return result.parsers;
  } catch (error) {
    console.error("Get parsers error:", error);
    throw error;
  }
}

export async function checkParserServiceHealth() {
  try {
    const response = await fetch(`${PARSER_SERVICE_URL}/health`);
    const result = await response.json();
    return result.status === "ok";
  } catch (error) {
    return false;
  }
}
