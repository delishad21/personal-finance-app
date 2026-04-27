import type { Transaction } from "@/components/transaction-table/types";

type TripEntryType = "spending" | "reimbursement" | "funding_out" | "funding_in";

export interface TripImportFundingOutDraft {
  destinationType?: "bank" | "trip" | "external";
  destinationTripId?: string;
  destinationCurrency?: string;
  destinationAmount?: string;
  fxRate?: string;
  feeAmount?: string;
  feeCurrency?: string;
  inputMode?: "amount" | "fxRate";
}

export interface TripImportPayload {
  date: string;
  description: string;
  label?: string;
  categoryId?: string;
  entryType?: TripEntryType;
  linkage?: {
    type: "reimbursement";
    reimbursesAllocations?: Array<{
      transactionId?: string;
      pendingBatchIndex?: number;
      amountBase: number;
    }>;
    leftoverCategoryId?: string | null;
    reimbursementBaseAmount?: number | null;
    reimbursingFxRate?: number | null;
  } | null;
  amountIn?: number;
  amountOut?: number;
  fundingOut?: {
    destinationType?: "bank" | "trip" | "external";
    destinationTripId?: string | null;
    destinationCurrency?: string | null;
    destinationAmount?: number | null;
    fxRate?: number | null;
    feeAmount?: number | null;
    feeCurrency?: string | null;
  } | null;
  metadata?: Record<string, any>;
}

const isTopupLikeTransaction = (transaction: Transaction) => {
  const metadata =
    transaction.metadata && typeof transaction.metadata === "object"
      ? (transaction.metadata as Record<string, unknown>)
      : {};
  const transactionType = String(metadata.transactionType || "")
    .trim()
    .toLowerCase();
  return (
    transaction.entryTypeOverride === "funding_in" ||
    (transactionType === "topup" && metadata.fundingInDisabled !== true)
  );
};

const buildEntryType = (transaction: Transaction): TripEntryType | undefined => {
  if (isTopupLikeTransaction(transaction)) return "funding_in";
  if (transaction.entryTypeOverride === "funding_out") return "funding_out";
  if (
    transaction.entryTypeOverride === "reimbursement" ||
    transaction.linkage?.type === "reimbursement"
  ) {
    return "reimbursement";
  }
  return transaction.entryTypeOverride;
};

const toNullableNumber = (value: string | undefined) => {
  const parsed = Number(value || 0);
  return parsed || null;
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const isFundingOutDestinationType = (
  value: unknown,
): value is "bank" | "trip" | "external" =>
  value === "bank" || value === "trip" || value === "external";

const readFundingOutDraftFromMetadata = (
  transaction: Transaction,
): TripImportFundingOutDraft | null => {
  const metadata = toRecord(transaction.metadata);
  const raw = toRecord(metadata?.fundingOutConfig);
  if (!raw) return null;

  return {
    destinationType: isFundingOutDestinationType(raw.destinationType)
      ? raw.destinationType
      : "external",
    destinationTripId: String(raw.destinationTripId || ""),
    destinationCurrency: String(raw.destinationCurrency || ""),
    destinationAmount: String(raw.destinationAmount || ""),
    fxRate: String(raw.fxRate || ""),
    feeAmount: String(raw.feeAmount || ""),
    feeCurrency: String(raw.feeCurrency || ""),
    inputMode:
      String(raw.inputMode || "").toLowerCase() === "fxrate"
        ? "fxRate"
        : "amount",
  };
};

export function buildTripImportPayload(
  transaction: Transaction,
  options: { fundingOutDraft?: TripImportFundingOutDraft | null } = {},
): TripImportPayload {
  const entryType = buildEntryType(transaction);
  const reimbursementLinkage =
    entryType === "reimbursement" && transaction.linkage?.type === "reimbursement"
      ? transaction.linkage
      : null;
  const hasExplicitFundingOutDraft = Object.prototype.hasOwnProperty.call(
    options,
    "fundingOutDraft",
  );
  const fundingOutDraft =
    entryType === "funding_out"
      ? hasExplicitFundingOutDraft
        ? options.fundingOutDraft
        : readFundingOutDraftFromMetadata(transaction)
      : null;

  return {
    date: transaction.date,
    description: transaction.description,
    label: transaction.label,
    categoryId: transaction.categoryId,
    entryType,
    linkage: reimbursementLinkage
      ? {
          type: "reimbursement",
          reimbursesAllocations: (
            reimbursementLinkage.reimbursesAllocations || []
          ).map((item) => ({
            transactionId: item.transactionId,
            pendingBatchIndex: item.pendingBatchIndex,
            amountBase: Number(item.amountBase ?? item.amount ?? 0),
          })),
          reimbursementBaseAmount:
            reimbursementLinkage.reimbursementBaseAmount ?? null,
          reimbursingFxRate: reimbursementLinkage.reimbursingFxRate ?? null,
          leftoverCategoryId: reimbursementLinkage.leftoverCategoryId ?? null,
        }
      : null,
    amountIn: transaction.amountIn ?? undefined,
    amountOut: transaction.amountOut ?? undefined,
    fundingOut: fundingOutDraft
      ? {
          destinationType: fundingOutDraft.destinationType,
          destinationTripId:
            fundingOutDraft.destinationType === "trip"
              ? fundingOutDraft.destinationTripId || null
              : null,
          destinationCurrency: fundingOutDraft.destinationCurrency || null,
          destinationAmount:
            fundingOutDraft.inputMode === "amount"
              ? toNullableNumber(fundingOutDraft.destinationAmount)
              : null,
          fxRate:
            fundingOutDraft.inputMode === "fxRate"
              ? toNullableNumber(fundingOutDraft.fxRate)
              : null,
          feeAmount: toNullableNumber(fundingOutDraft.feeAmount),
          feeCurrency: fundingOutDraft.feeCurrency || null,
        }
      : null,
    metadata: transaction.metadata,
  };
}
