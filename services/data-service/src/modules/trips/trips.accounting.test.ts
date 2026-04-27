import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateReimbursementLeftoverBase,
  collectImpactedReimbursementEntryIds,
  buildFundingUpdatePayload,
  hasFundingCoreValueChanged,
  normalizeCurrencyCode,
  normalizeOptionalCurrencyUpdate,
  normalizeFundingValues,
  resolveFundingOutFeeBaseAmount,
  resolveTripImportBaseAmount,
  shouldPreserveFundingBaseAmount,
  toCurrency,
  validateFundingOutFeeCurrency,
  validateFundingInBankMatch,
} from "./trips.accounting";

describe("trip accounting helpers", () => {
  describe("toCurrency", () => {
    it("normalizes currency values and falls back when blank", () => {
      assert.equal(toCurrency(" usd "), "USD");
      assert.equal(toCurrency("", "sgd"), "SGD");
      assert.equal(toCurrency(null, "jpy"), "JPY");
    });
  });

  describe("normalizeCurrencyCode", () => {
    it("uppercases a 3-letter currency code", () => {
      assert.equal(normalizeCurrencyCode("usd"), "USD");
    });

    it("rejects non-3-letter currency codes", () => {
      assert.throws(() => normalizeCurrencyCode("US"), {
        message: "Currency must be a 3-letter ISO code.",
      });
    });

    it("falls back when the value is empty", () => {
      assert.equal(normalizeCurrencyCode(""), "SGD");
      assert.equal(normalizeCurrencyCode(" ", "jpy"), "JPY");
    });
  });

  describe("normalizeOptionalCurrencyUpdate", () => {
    it("returns null when an update omits base currency", () => {
      assert.equal(normalizeOptionalCurrencyUpdate(undefined), null);
    });

    it("returns null when an update sends null or empty base currency", () => {
      assert.equal(normalizeOptionalCurrencyUpdate(null), null);
      assert.equal(normalizeOptionalCurrencyUpdate(""), null);
      assert.equal(normalizeOptionalCurrencyUpdate("  "), null);
    });

    it("normalizes non-empty update base currency values", () => {
      assert.equal(normalizeOptionalCurrencyUpdate(" usd "), "USD");
    });

    it("rejects invalid non-empty update base currency values", () => {
      assert.throws(() => normalizeOptionalCurrencyUpdate("US"), {
        message: "Currency must be a 3-letter ISO code.",
      });
    });
  });

  describe("collectImpactedReimbursementEntryIds", () => {
    it("includes the reimbursement entry, removed targets, and next targets once", () => {
      const result = collectImpactedReimbursementEntryIds({
        reimbursementEntryId: " reimbursement-1 ",
        previousTargetIds: ["target-removed", "target-kept", "", "target-kept"],
        nextTargetIds: ["target-kept", "target-added", "  "],
      });

      assert.deepEqual(result, [
        "reimbursement-1",
        "target-removed",
        "target-kept",
        "target-added",
      ]);
    });
  });

  describe("calculateReimbursementLeftoverBase", () => {
    it("uses current reimbursement base amount minus current allocations", () => {
      const result = calculateReimbursementLeftoverBase({
        reimbursementBaseAmount: 100,
        allocationBaseAmounts: [20],
      });

      assert.equal(result, 80);
    });
  });

  describe("normalizeFundingValues", () => {
    it("rejects third-currency funding without an explicit base amount", () => {
      assert.throws(
        () =>
          normalizeFundingValues({
            sourceCurrency: "USD",
            sourceAmount: 100,
            destinationCurrency: "JPY",
            destinationAmount: 15_000,
            baseCurrency: "SGD",
          }),
        /base amount is required/i,
      );
    });

    it("accepts explicit base amount for third-currency funding", () => {
      const result = normalizeFundingValues({
        sourceCurrency: "USD",
        sourceAmount: 100,
        destinationCurrency: "JPY",
        destinationAmount: 15_000,
        baseCurrency: "SGD",
        baseAmount: 135,
      });

      assert.equal(result.baseAmount, 135);
      assert.equal(result.fxRate, 100 / 15_000);
    });

    it("uses source amount when source currency equals base", () => {
      const result = normalizeFundingValues({
        sourceCurrency: "SGD",
        sourceAmount: 200,
        destinationCurrency: "JPY",
        destinationAmount: 20_000,
        baseCurrency: "SGD",
      });

      assert.equal(result.baseAmount, 200);
    });

    it("uses destination amount plus destination-denominated fee when destination currency equals base", () => {
      const result = normalizeFundingValues({
        sourceCurrency: "USD",
        sourceAmount: 75,
        destinationCurrency: "SGD",
        destinationAmount: 100,
        feeAmount: 2,
        feeCurrency: "SGD",
        baseCurrency: "SGD",
      });

      assert.equal(result.baseAmount, 102);
    });
  });

  describe("resolveFundingOutFeeBaseAmount", () => {
    it("converts source-currency funding-out fees through the source base rate", () => {
      const result = resolveFundingOutFeeBaseAmount({
        feeAmount: 2,
        feeCurrency: "USD",
        baseCurrency: "SGD",
        sourceCurrency: "USD",
        destinationCurrency: "JPY",
        sourceAmount: 100,
        sourceBaseAmount: 135,
        fxRate: 100 / 15_000,
      });

      assert.equal(result, 2.7);
    });

    it("converts destination-currency funding-out fees through destination-to-source and source-to-base rates", () => {
      const result = resolveFundingOutFeeBaseAmount({
        feeAmount: 150,
        feeCurrency: "JPY",
        baseCurrency: "SGD",
        sourceCurrency: "USD",
        destinationCurrency: "JPY",
        sourceAmount: 100,
        sourceBaseAmount: 135,
        fxRate: 100 / 15_000,
      });

      assert.equal(result, 1.35);
    });

    it("returns base-currency funding-out fees as the base fee amount", () => {
      const result = resolveFundingOutFeeBaseAmount({
        feeAmount: 3,
        feeCurrency: "SGD",
        baseCurrency: "SGD",
        sourceCurrency: "USD",
        destinationCurrency: "JPY",
        sourceAmount: 100,
        sourceBaseAmount: 135,
        fxRate: 100 / 15_000,
      });

      assert.equal(result, 3);
    });
  });

  describe("shouldPreserveFundingBaseAmount", () => {
    it("preserves base amount for fee-only third-currency funding updates", () => {
      const result = shouldPreserveFundingBaseAmount({
        fundingCoreValueChanged: false,
        sourceCurrency: "USD",
        destinationCurrency: "JPY",
        baseCurrency: "SGD",
      });

      assert.equal(result, true);
    });

    it("does not preserve base amount when source, destination, or FX values change", () => {
      const result = shouldPreserveFundingBaseAmount({
        fundingCoreValueChanged: true,
        sourceCurrency: "USD",
        destinationCurrency: "JPY",
        baseCurrency: "SGD",
      });

      assert.equal(result, false);
    });

    it("does not preserve base amount when a funding currency matches the trip base", () => {
      assert.equal(
        shouldPreserveFundingBaseAmount({
          fundingCoreValueChanged: false,
          sourceCurrency: "SGD",
          destinationCurrency: "JPY",
          baseCurrency: "SGD",
        }),
        false,
      );
      assert.equal(
        shouldPreserveFundingBaseAmount({
          fundingCoreValueChanged: false,
          sourceCurrency: "USD",
          destinationCurrency: "SGD",
          baseCurrency: "SGD",
        }),
        false,
      );
    });
  });

  describe("hasFundingCoreValueChanged", () => {
    const current = {
      sourceCurrency: "USD",
      sourceAmount: 100,
      destinationCurrency: "JPY",
      destinationAmount: 15_000,
      fxRate: 100 / 15_000,
    };

    it("does not treat unchanged submitted core values as changed", () => {
      const result = hasFundingCoreValueChanged({
        current,
        next: {
          sourceCurrency: "usd",
          sourceAmount: 100,
          destinationCurrency: "jpy",
          destinationAmount: 15_000,
          fxRate: 100 / 15_000,
        },
      });

      assert.equal(result, false);
    });

    it("ignores null fxRate when current fxRate is empty", () => {
      const result = hasFundingCoreValueChanged({
        current: { ...current, fxRate: null },
        next: { fxRate: null },
      });

      assert.equal(result, false);
    });

    it("detects changed source, destination, and FX values", () => {
      assert.equal(
        hasFundingCoreValueChanged({
          current,
          next: { sourceAmount: 100.01 },
        }),
        true,
      );
      assert.equal(
        hasFundingCoreValueChanged({
          current,
          next: { destinationCurrency: "SGD" },
        }),
        true,
      );
      assert.equal(
        hasFundingCoreValueChanged({
          current,
          next: { fxRate: current.fxRate + 0.001 },
        }),
        true,
      );
    });
  });

  describe("buildFundingUpdatePayload", () => {
    it("preserves undefined for omitted nullable funding update fields", () => {
      const result = buildFundingUpdatePayload({
        walletId: undefined,
        sourceCurrency: undefined,
        sourceAmount: undefined,
        destinationCurrency: undefined,
        destinationAmount: undefined,
        fxRate: undefined,
        feeAmount: undefined,
        feeCurrency: undefined,
        metadata: undefined,
      });

      assert.equal(result.fxRate, undefined);
      assert.equal(result.feeAmount, undefined);
      assert.equal(result.feeCurrency, undefined);
      assert.equal(result.metadata, undefined);
    });

    it("preserves explicit nulls for nullable funding update fields", () => {
      const result = buildFundingUpdatePayload({
        fxRate: null,
        feeAmount: null,
        feeCurrency: null,
        metadata: null,
      });

      assert.equal(result.fxRate, null);
      assert.equal(result.feeAmount, null);
      assert.equal(result.feeCurrency, null);
      assert.equal(result.metadata, null);
    });
  });

  describe("validateFundingOutFeeCurrency", () => {
    it("allows source, destination, and trip base fee currencies", () => {
      const input = {
        sourceCurrency: "USD",
        destinationCurrency: "JPY",
        tripBaseCurrency: "SGD",
      };

      assert.doesNotThrow(() =>
        validateFundingOutFeeCurrency({ ...input, feeCurrency: "USD" }),
      );
      assert.doesNotThrow(() =>
        validateFundingOutFeeCurrency({ ...input, feeCurrency: "JPY" }),
      );
      assert.doesNotThrow(() =>
        validateFundingOutFeeCurrency({ ...input, feeCurrency: "SGD" }),
      );
    });

    it("rejects unrelated funding-out fee currencies", () => {
      assert.throws(
        () =>
          validateFundingOutFeeCurrency({
            feeCurrency: "EUR",
            sourceCurrency: "USD",
            destinationCurrency: "JPY",
            tripBaseCurrency: "SGD",
          }),
        {
          message:
            "Funding out fee currency must be either the source, destination, or trip base currency.",
        },
      );
    });
  });

  describe("validateFundingInBankMatch", () => {
    const matchingInput = {
      fundingSourceAmount: 100,
      fundingSourceCurrency: "SGD",
      bankAmountOut: 100,
      bankCurrency: "SGD",
    };

    it("rejects a linked bank transaction that is not a debit", () => {
      assert.throws(
        () =>
          validateFundingInBankMatch({
            ...matchingInput,
            bankAmountOut: 0,
          }),
        {
          message:
            "Linked bank transaction must be a debit (amount out) for funding in.",
        },
      );
    });

    it("rejects a bank amount that differs from the funding source amount by more than one cent", () => {
      assert.throws(
        () =>
          validateFundingInBankMatch({
            ...matchingInput,
            fundingSourceAmount: 0.03,
            bankAmountOut: 0.019,
          }),
        {
          message: "Source amount must match the linked bank transaction amount out.",
        },
      );
    });

    it("accepts a bank amount that differs from the funding source amount by exactly one cent", () => {
      assert.doesNotThrow(() =>
        validateFundingInBankMatch({
          ...matchingInput,
          fundingSourceAmount: 0.03,
          bankAmountOut: 0.02,
        }),
      );
    });

    it("rejects a bank currency that differs from the funding source currency", () => {
      assert.throws(
        () =>
          validateFundingInBankMatch({
            ...matchingInput,
            bankCurrency: "USD",
          }),
        {
          message: "Source currency must match the linked bank transaction currency.",
        },
      );
    });

    it("accepts a matching debit amount and currency", () => {
      assert.doesNotThrow(() =>
        validateFundingInBankMatch({
          ...matchingInput,
          bankCurrency: " sgd ",
        }),
      );
    });
  });

  describe("resolveTripImportBaseAmount", () => {
    it("rejects third-currency import rows when metadata cannot map FX to base", () => {
      assert.throws(
        () =>
          resolveTripImportBaseAmount({
            localAmount: 15_000,
            localCurrency: "JPY",
            statementAmount: 100,
            statementCurrency: "USD",
            baseCurrency: "SGD",
            metadata: {},
          }),
        /base amount is required/i,
      );
    });

    it("uses local amount when local currency equals base", () => {
      const result = resolveTripImportBaseAmount({
        localAmount: 42,
        localCurrency: "SGD",
        statementAmount: 31,
        statementCurrency: "USD",
        baseCurrency: "SGD",
        metadata: {},
      });

      assert.equal(result, 42);
    });

    it("uses statement amount when statement currency equals base", () => {
      const result = resolveTripImportBaseAmount({
        localAmount: 15_000,
        localCurrency: "JPY",
        statementAmount: 135,
        statementCurrency: "SGD",
        baseCurrency: "SGD",
        metadata: {},
      });

      assert.equal(result, 135);
    });

    it("uses metadata FX mappings when they map local currency to base", () => {
      const result = resolveTripImportBaseAmount({
        localAmount: 15_000,
        localCurrency: "JPY",
        statementAmount: 100,
        statementCurrency: "USD",
        baseCurrency: "SGD",
        metadata: {
          fxRate: 0.009,
          fxBaseCurrency: "JPY",
          fxQuoteCurrency: "SGD",
        },
      });

      assert.equal(result, 135);
    });

    it("lets manual base amount and manual FX rate override import fallback", () => {
      assert.equal(
        resolveTripImportBaseAmount({
          localAmount: 15_000,
          localCurrency: "JPY",
          statementAmount: 100,
          statementCurrency: "USD",
          baseCurrency: "SGD",
          metadata: { manualBaseAmount: 140 },
        }),
        140,
      );

      assert.equal(
        resolveTripImportBaseAmount({
          localAmount: 15_000,
          localCurrency: "JPY",
          statementAmount: 100,
          statementCurrency: "USD",
          baseCurrency: "SGD",
          metadata: { manualFxRate: 0.01 },
        }),
        150,
      );
    });
  });
});
