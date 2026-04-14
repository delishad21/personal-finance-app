"use server";

import { auth } from "@/lib/auth";
import { getCategories } from "@/app/actions/categories";
import { getImportRules, bootstrapDefaultImportRules } from "@/app/actions/importRules";
import { prisma } from "@/lib/db/client";
import { applyAutoCategorization } from "@/lib/auto-categorization";

const PARSER_SERVICE_URL =
  process.env.PARSER_SERVICE_URL || "http://file-parser:4000";

const TRIP_PARSER_IDS = new Set(["revolut_statement", "youtrip_statement"]);

interface TransactionLinkage {
  type: "internal" | "reimbursement" | "reimbursed";
  reimbursesAllocations?: Array<{
    transactionId?: string;
    pendingBatchIndex?: number;
    amount: number;
  }>;
  reimbursedByAllocations?: Array<{
    transactionId: string;
    amount: number;
  }>;
  leftoverAmount?: number;
  leftoverCategoryId?: string | null;
  autoDetected?: boolean;
  detectionReason?: string;
}

interface ParseResult {
  success: boolean;
  filename: string;
  parserId: string;
  transactions: Array<{
    date: string;
    description: string;
    label?: string;
    categoryId?: string;
    amountIn?: number;
    amountOut?: number;
    balance?: number;
    accountIdentifier?: string;
    accountNumber?: string;
    metadata: Record<string, any>;
    linkage?: TransactionLinkage | null;
    suggestedCategoryId?: string;
    suggestedLabel?: string;
    suggestedInternal?: boolean;
    suggestionSource?: "rule" | "history" | "heuristic";
    suggestionConfidence?: number;
    suggestionApplied?: boolean;
  }>;
  count: number;
}

function ruleMatches(
  rule: {
    matchType: "always" | "description_contains";
    matchValue?: string | null;
    caseSensitive?: boolean;
  },
  description: string,
) {
  if (rule.matchType === "always") return true;
  if (rule.matchType === "description_contains") {
    const needle = (rule.matchValue || "").trim();
    if (!needle) return false;
    if (rule.caseSensitive) return description.includes(needle);
    return description.toLowerCase().includes(needle.toLowerCase());
  }
  return false;
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

    const session = await auth();
    const normalizedParserId = String(result.parserId || "")
      .trim()
      .toLowerCase();
    const shouldApplyImportRules = !TRIP_PARSER_IDS.has(normalizedParserId);

    if (session?.user?.id && shouldApplyImportRules) {
      try {
        await bootstrapDefaultImportRules();
        const rules = await getImportRules();
        const categories = await getCategories({ scope: "main" });
        const categoryMap = new Map<string, string>(
          categories.map((category) => [category.name.toLowerCase(), category.id]),
        );

        result.transactions = result.transactions.map((tx: any) => {
          const next = { ...tx };
          for (const rule of rules) {
            if (!rule.enabled) continue;
            const ruleParserId = rule.parserId?.trim();
            if (ruleParserId && ruleParserId !== result.parserId) continue;
            if (!ruleMatches(rule, next.description || "")) continue;

            if (rule.markInternal && !next.linkage) {
              next.linkage = {
                type: "internal",
                autoDetected: true,
                detectionReason: `Matched import rule: ${rule.name}`,
              };
            }

            if (rule.setLabel && (!next.label || !next.label.trim())) {
              next.label = rule.setLabel;
            }

            if (
              rule.setCategoryName &&
              !next.categoryId &&
              (!next.linkage || next.linkage.type === "reimbursed")
            ) {
              const categoryId = categoryMap.get(
                rule.setCategoryName.toLowerCase(),
              );
              if (categoryId) {
                next.categoryId = categoryId;
              }
            }
          }
          return next;
        });

        const userSettings = await prisma.userSettings.findUnique({
          where: { userId: session.user.id },
          select: { autoLabelEnabled: true, autoLabelThreshold: true },
        });

        result.transactions = await applyAutoCategorization(
          {
            userId: session.user.id,
            parserId: String(result.parserId || ""),
            transactions: result.transactions,
            categoryByName: new Map(
              categories.map((category) => [category.name.toLowerCase(), category.id]),
            ),
          },
          {
            enabled: userSettings?.autoLabelEnabled ?? false,
            threshold: Number(userSettings?.autoLabelThreshold ?? 0.5),
          },
        );
      } catch (rulesError) {
        console.error("Failed to apply import rules in parse stage:", rulesError);
      }
    }

    return result;
  } catch (error) {
    console.error("Parse file error:", error);
    throw error;
  }
}

export async function getAvailableParsers(mode?: "bank" | "trip") {
  try {
    const query = mode ? `?mode=${mode}` : "";
    const response = await fetch(`${PARSER_SERVICE_URL}/parsers${query}`);

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
