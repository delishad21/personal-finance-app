import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTripImportPayload } from "./tripImportPayload";
import type { Transaction } from "@/components/transaction-table/types";

describe("buildTripImportPayload", () => {
  it("preserves reviewed reimbursement linkage, amounts, and metadata", () => {
    const transaction: Transaction = {
      date: "2026-03-01",
      description: "Dinner refund",
      label: "Refund from Alex",
      categoryId: "cat-refunds",
      entryTypeOverride: "reimbursement",
      amountIn: 125.5,
      amountOut: 0,
      metadata: { provider: "revolut", row: 7 },
      linkage: {
        type: "reimbursement",
        reimbursesAllocations: [
          {
            transactionId: "entry-1",
            pendingBatchIndex: 2,
            amount: 80,
            amountBase: 75.25,
          },
        ],
        reimbursementBaseAmount: 118.33,
        reimbursingFxRate: 0.94286853,
        leftoverCategoryId: "cat-leftover",
      },
    };

    assert.deepEqual(buildTripImportPayload(transaction), {
      date: "2026-03-01",
      description: "Dinner refund",
      label: "Refund from Alex",
      categoryId: "cat-refunds",
      entryType: "reimbursement",
      linkage: {
        type: "reimbursement",
        reimbursesAllocations: [
          {
            transactionId: "entry-1",
            pendingBatchIndex: 2,
            amountBase: 75.25,
          },
        ],
        reimbursementBaseAmount: 118.33,
        reimbursingFxRate: 0.94286853,
        leftoverCategoryId: "cat-leftover",
      },
      amountIn: 125.5,
      amountOut: 0,
      fundingOut: null,
      metadata: { provider: "revolut", row: 7 },
    });
  });

  it("preserves funding out configuration", () => {
    const transaction: Transaction = {
      date: "2026-03-02",
      description: "Transfer to next trip",
      entryTypeOverride: "funding_out",
      amountOut: 200,
      metadata: { source: "review" },
    };

    assert.deepEqual(
      buildTripImportPayload(transaction, {
        fundingOutDraft: {
          destinationType: "trip",
          destinationTripId: "trip-2",
          destinationCurrency: "JPY",
          destinationAmount: "30000",
          fxRate: "151.25",
          feeAmount: "2.75",
          feeCurrency: "USD",
          inputMode: "amount",
        },
      }),
      {
        date: "2026-03-02",
        description: "Transfer to next trip",
        label: undefined,
        categoryId: undefined,
        entryType: "funding_out",
        linkage: null,
        amountIn: undefined,
        amountOut: 200,
        fundingOut: {
          destinationType: "trip",
          destinationTripId: "trip-2",
          destinationCurrency: "JPY",
          destinationAmount: 30000,
          fxRate: null,
          feeAmount: 2.75,
          feeCurrency: "USD",
        },
        metadata: { source: "review" },
      },
    );
  });

  it("preserves funding out configuration stored on transaction metadata", () => {
    const transaction: Transaction = {
      date: "2026-03-04",
      description: "Managed review transfer",
      entryTypeOverride: "funding_out",
      amountIn: 0,
      amountOut: 120,
      metadata: {
        fundingOutConfig: {
          destinationType: "bank",
          destinationTripId: null,
          destinationCurrency: "SGD",
          destinationAmount: "160.50",
          fxRate: "1.3375",
          feeAmount: "1.25",
          feeCurrency: "USD",
          inputMode: "fxRate",
        },
      },
    };

    assert.deepEqual(buildTripImportPayload(transaction).fundingOut, {
      destinationType: "bank",
      destinationTripId: null,
      destinationCurrency: "SGD",
      destinationAmount: null,
      fxRate: 1.3375,
      feeAmount: 1.25,
      feeCurrency: "USD",
    });
  });

  it("does not fall back to metadata funding out config when explicit draft is null", () => {
    const transaction: Transaction = {
      date: "2026-03-05",
      description: "Cleared funding out review",
      entryTypeOverride: "funding_out",
      amountOut: 120,
      metadata: {
        fundingOutConfig: {
          destinationType: "bank",
          destinationCurrency: "SGD",
          destinationAmount: "160.50",
          inputMode: "amount",
        },
      },
    };

    assert.equal(
      buildTripImportPayload(transaction, { fundingOutDraft: null }).fundingOut,
      null,
    );
  });

  it("preserves funding in for topup-like rows", () => {
    const transaction: Transaction = {
      date: "2026-03-03",
      description: "Card topup",
      amountIn: 500,
      amountOut: 3,
      metadata: { transactionType: "topup", provider: "youtrip" },
    };

    assert.equal(buildTripImportPayload(transaction).entryType, "funding_in");
    assert.deepEqual(buildTripImportPayload(transaction).metadata, {
      transactionType: "topup",
      provider: "youtrip",
    });
  });
});
