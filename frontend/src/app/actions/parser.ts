"use server";

const PARSER_SERVICE_URL =
  process.env.PARSER_SERVICE_URL || "http://file-parser:4000";

interface ParseResult {
  success: boolean;
  filename: string;
  parserId: string;
  transactions: Array<{
    date: string;
    description: string;
    amountIn?: number;
    amountOut?: number;
    balance?: number;
    metadata: Record<string, any>;
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
      const error = await response.json();
      throw new Error(error.message || "Failed to parse file");
    }

    const result = await response.json();
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
