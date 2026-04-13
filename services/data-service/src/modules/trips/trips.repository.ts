import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

type PropagationTraceStep = {
  phase: "recalculate_wallet" | "sync_linked_fundings";
  tripId: string;
  walletId: string;
  updatedEntryCount?: number;
  updatedFundingCount?: number;
  queuedWallets?: Array<{ tripId: string; walletId: string }>;
};

type PropagationTrace = {
  startedAt: string;
  finishedAt: string;
  seedWallets: Array<{ tripId: string; walletId: string }>;
  totalWalletRecalculations: number;
  totalFundingRowsUpdated: number;
  steps: PropagationTraceStep[];
  truncated: boolean;
};

type TripReimbursementAllocationInput = {
  transactionId?: string;
  pendingBatchIndex?: number;
  amountBase: number;
};

type TripEntryLinkage = {
  type: "reimbursement" | "reimbursed";
  reimbursesAllocations?: Array<{
    transactionId?: string;
    pendingBatchIndex?: number;
    amountBase: number;
    reimbursingLocalAmount?: number;
    reimbursedLocalAmount?: number;
    reimbursingCurrency?: string;
    reimbursedCurrency?: string;
    reimbursingFxRate?: number;
    reimbursedFxRate?: number;
  }>;
  reimbursedByAllocations?: Array<{
    transactionId: string;
    amountBase: number;
    reimbursingLocalAmount?: number;
    reimbursedLocalAmount?: number;
    reimbursingCurrency?: string;
    reimbursedCurrency?: string;
    reimbursingFxRate?: number;
    reimbursedFxRate?: number;
  }>;
  leftoverBaseAmount?: number;
  leftoverCategoryId?: string | null;
};

export class TripRepository {
  private static readonly WALLET_COLOR_PALETTE = [
    "#60a5fa",
    "#34d399",
    "#f59e0b",
    "#f87171",
    "#a78bfa",
    "#22d3ee",
    "#f472b6",
    "#84cc16",
    "#fb7185",
    "#38bdf8",
  ];

  private static pickWalletColor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return TripRepository.WALLET_COLOR_PALETTE[
      hash % TripRepository.WALLET_COLOR_PALETTE.length
    ];
  }

  private static resolveFundingFeeBaseAmount(input: {
    feeAmount: number;
    feeCurrency: string;
    baseCurrency: string;
    sourceCurrency: string;
    destinationCurrency: string;
    fxRate: number | null;
  }) {
    const feeAmount = Number(input.feeAmount || 0);
    if (!(feeAmount > 0)) return 0;

    const feeCurrency = String(input.feeCurrency || "").toUpperCase();
    const baseCurrency = String(input.baseCurrency || "").toUpperCase();
    const sourceCurrency = String(input.sourceCurrency || "").toUpperCase();
    const destinationCurrency = String(input.destinationCurrency || "").toUpperCase();
    const fxRate = Number(input.fxRate || 0);

    if (feeCurrency === baseCurrency) return feeAmount;
    if (!(fxRate > 0)) return feeAmount;

    if (feeCurrency === sourceCurrency && sourceCurrency === baseCurrency) {
      return feeAmount;
    }
    if (feeCurrency === destinationCurrency && sourceCurrency === baseCurrency) {
      return feeAmount * fxRate;
    }
    if (feeCurrency === sourceCurrency && destinationCurrency === baseCurrency) {
      return feeAmount / fxRate;
    }
    if (feeCurrency === destinationCurrency && destinationCurrency === baseCurrency) {
      return feeAmount;
    }

    return feeAmount;
  }

  private static resolveFundingOutFeeBaseAmount(input: {
    feeAmount: number;
    feeCurrency: string;
    baseCurrency: string;
    sourceCurrency: string;
    destinationCurrency: string;
    sourceAmount: number;
    sourceBaseAmount: number;
    fxRate: number;
  }) {
    const feeAmount = Number(input.feeAmount || 0);
    if (!(feeAmount > 0)) return 0;

    const feeCurrency = String(input.feeCurrency || "").toUpperCase();
    const baseCurrency = String(input.baseCurrency || "").toUpperCase();
    const sourceCurrency = String(input.sourceCurrency || "").toUpperCase();
    const destinationCurrency = String(input.destinationCurrency || "").toUpperCase();
    const sourceAmount = Number(input.sourceAmount || 0);
    const sourceBaseAmount = Number(input.sourceBaseAmount || 0);
    const fxRate = Number(input.fxRate || 0);

    if (feeCurrency === baseCurrency) return feeAmount;

    const sourceToBaseRate =
      sourceAmount > 0 && sourceBaseAmount > 0
        ? sourceBaseAmount / sourceAmount
        : 1;

    if (feeCurrency === sourceCurrency) {
      return feeAmount * sourceToBaseRate;
    }
    if (feeCurrency === destinationCurrency && fxRate > 0) {
      return feeAmount * fxRate * sourceToBaseRate;
    }

    return feeAmount * sourceToBaseRate;
  }

  private static async getUserBaseCurrency(userId: string) {
    const [row] = await prisma.$queryRaw<Array<{ currency: string | null }>>`
      SELECT currency
      FROM user_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    return String(row?.currency || "SGD").toUpperCase();
  }

  private static buildTripCategoryFilterSql(categoryId: string) {
    const normalized = String(categoryId || "").trim().toLowerCase();
    if (!normalized) return Prisma.sql`TRUE`;
    if (normalized === "__reimbursement__" || normalized === "reimbursement") {
      return Prisma.sql`te.type = 'reimbursement'`;
    }
    if (normalized === "__funding_in__" || normalized === "funding_in") {
      return Prisma.sql`te.type = 'funding_in'`;
    }
    if (normalized === "__funding_out__" || normalized === "funding_out") {
      return Prisma.sql`te.type = 'funding_out'`;
    }
    return Prisma.sql`te.category_id = ${categoryId}`;
  }

  private static normalizeFundingValues(input: {
    sourceCurrency: string;
    sourceAmount: number;
    destinationCurrency: string;
    destinationAmount?: number | null;
    fxRate?: number | null;
    feeAmount?: number | null;
    feeCurrency?: string | null;
    baseCurrency: string;
  }) {
    const sourceCurrency = String(input.sourceCurrency || "").toUpperCase();
    const destinationCurrency = String(input.destinationCurrency || "").toUpperCase();
    const baseCurrency = String(input.baseCurrency || "SGD").toUpperCase();
    const sourceAmount = Number(input.sourceAmount || 0);

    if (!sourceCurrency || !destinationCurrency) {
      throw new Error("Source and destination currencies are required.");
    }
    if (!(sourceAmount > 0)) {
      throw new Error("Source amount must be greater than 0.");
    }

    const rawFeeAmount = Number(input.feeAmount || 0);
    const feeAmount = rawFeeAmount > 0 ? rawFeeAmount : 0;
    const feeCurrency = feeAmount
      ? String(input.feeCurrency || sourceCurrency).toUpperCase()
      : null;

    if (
      feeCurrency &&
      feeCurrency !== sourceCurrency &&
      feeCurrency !== destinationCurrency
    ) {
      throw new Error(
        "Fee currency must be either source currency or destination currency.",
      );
    }

    const requestedDestinationAmount =
      input.destinationAmount === null || input.destinationAmount === undefined
        ? null
        : Number(input.destinationAmount);
    const requestedFxRate =
      input.fxRate === null || input.fxRate === undefined
        ? null
        : Number(input.fxRate);

    let fxRate = 1;
    let destinationAmount = requestedDestinationAmount ?? 0;
    let feeInDestination = 0;

    if (sourceCurrency === destinationCurrency) {
      fxRate = 1;
      feeInDestination = feeAmount;
      const expectedDestination = sourceAmount - feeInDestination;
      if (!(expectedDestination > 0)) {
        throw new Error("Fee exceeds source amount.");
      }

      if (requestedDestinationAmount !== null) {
        if (Math.abs(requestedDestinationAmount - expectedDestination) > 0.01) {
          throw new Error(
            "For same-currency funding, destination amount must equal source amount minus fee.",
          );
        }
        destinationAmount = requestedDestinationAmount;
      } else {
        destinationAmount = expectedDestination;
      }
    } else {
      if (requestedFxRate !== null && requestedDestinationAmount !== null) {
        const provisionalFeeInDestination =
          feeAmount > 0 && feeCurrency === sourceCurrency
            ? feeAmount / requestedFxRate
            : feeAmount;
        const expectedSource =
          (requestedDestinationAmount + provisionalFeeInDestination) *
          requestedFxRate;
        if (Math.abs(expectedSource - sourceAmount) > 0.01) {
          throw new Error(
            "Provide either destination amount or FX rate, or ensure both are consistent with source and fee.",
          );
        }
        fxRate = requestedFxRate;
        destinationAmount = requestedDestinationAmount;
        feeInDestination = provisionalFeeInDestination;
      } else if (requestedFxRate !== null) {
        if (!(requestedFxRate > 0)) {
          throw new Error("FX rate must be greater than 0.");
        }
        fxRate = requestedFxRate;
        feeInDestination =
          feeAmount > 0 && feeCurrency === sourceCurrency
            ? feeAmount / fxRate
            : feeAmount;
        destinationAmount = sourceAmount / fxRate - feeInDestination;
      } else if (requestedDestinationAmount !== null) {
        if (!(requestedDestinationAmount > 0)) {
          throw new Error("Destination amount must be greater than 0.");
        }
        destinationAmount = requestedDestinationAmount;
        feeInDestination =
          feeAmount > 0 && feeCurrency === destinationCurrency
            ? feeAmount
            : 0;
        const denominator = destinationAmount + feeInDestination;
        if (!(denominator > 0)) {
          throw new Error("Destination amount must remain greater than 0.");
        }
        fxRate = sourceAmount / denominator;
      } else {
        throw new Error("Either destination amount or FX rate is required.");
      }
    }

    if (!(destinationAmount > 0)) {
      throw new Error(
        "Destination amount must remain greater than 0 after fee deduction.",
      );
    }
    if (!(fxRate > 0)) {
      throw new Error("FX rate must be greater than 0.");
    }

    let baseAmount = sourceAmount;
    if (sourceCurrency === baseCurrency) {
      baseAmount = sourceAmount;
    } else if (destinationCurrency === baseCurrency) {
      baseAmount = destinationAmount + feeInDestination;
    }

    return {
      sourceCurrency,
      sourceAmount,
      destinationCurrency,
      destinationAmount,
      fxRate,
      feeAmount: feeAmount > 0 ? feeAmount : null,
      feeCurrency: feeAmount > 0 ? feeCurrency : null,
      baseAmount,
    };
  }

  private static async normalizeFundingOutConfig(
    tx: Prisma.TransactionClient,
    userId: string,
    input: {
      tripBaseCurrency: string;
      sourceCurrency: string;
      sourceAmount: number;
      sourceBaseAmount: number;
      fundingOut?: {
        destinationType?: "bank" | "trip" | "external";
        destinationTripId?: string | null;
        bankTransactionId?: string | null;
        destinationCurrency?: string | null;
        destinationAmount?: number | null;
        fxRate?: number | null;
        feeAmount?: number | null;
        feeCurrency?: string | null;
      } | null;
    },
  ) {
    const tripBaseCurrency = String(input.tripBaseCurrency || "SGD").toUpperCase();
    const sourceCurrency = String(input.sourceCurrency || tripBaseCurrency).toUpperCase();
    const sourceAmount = Number(input.sourceAmount || 0);
    const sourceBaseAmount = Number(input.sourceBaseAmount || 0);

    if (!(sourceAmount > 0)) {
      throw new Error("Funding out source amount must be greater than 0.");
    }

    const rawType = String(input.fundingOut?.destinationType || "external").toLowerCase();
    const destinationType: "bank" | "trip" | "external" =
      rawType === "bank" || rawType === "trip" || rawType === "external"
        ? rawType
        : "external";

    const destinationTripId =
      destinationType === "trip"
        ? input.fundingOut?.destinationTripId
          ? String(input.fundingOut.destinationTripId)
          : null
        : null;

    const linkedBankTransactionId = input.fundingOut?.bankTransactionId
      ? String(input.fundingOut.bankTransactionId)
      : null;

    let destinationCurrency = String(
      input.fundingOut?.destinationCurrency || sourceCurrency,
    ).toUpperCase();
    if (destinationType === "bank") {
      destinationCurrency = tripBaseCurrency;
    }

    let destinationAmount = Number(input.fundingOut?.destinationAmount || 0);
    let fxRate = Number(input.fundingOut?.fxRate || 0);
    const hasRequestedDestinationAmount = destinationAmount > 0;
    const hasRequestedFxRate = fxRate > 0;

    const feeRaw = Number(input.fundingOut?.feeAmount || 0);
    const feeAmount = feeRaw > 0 ? feeRaw : null;
    const feeCurrency =
      feeAmount && feeAmount > 0
        ? String(
            input.fundingOut?.feeCurrency ||
              (destinationType === "bank" ? tripBaseCurrency : destinationCurrency),
          ).toUpperCase()
        : null;

    if (
      feeCurrency &&
      feeCurrency !== sourceCurrency &&
      feeCurrency !== destinationCurrency
    ) {
      throw new Error(
        "Funding out fee currency must be either the source or destination currency.",
      );
    }

    if (linkedBankTransactionId) {
      const linkedRows = await tx.$queryRaw<Array<{ amountIn: unknown }>>`
        SELECT amount_in AS "amountIn"
        FROM transactions
        WHERE id = ${linkedBankTransactionId} AND user_id = ${userId}
        LIMIT 1
      `;
      if (!linkedRows[0]) {
        throw new Error("Linked bank transaction not found or unauthorized.");
      }

      const linkedAmountIn = Number(linkedRows[0].amountIn || 0);
      if (!(linkedAmountIn > 0)) {
        throw new Error(
          "Linked bank transaction must be a positive bank credit (amount in).",
        );
      }

      if (destinationType !== "bank") {
        throw new Error(
          "Linked bank transaction can only be used when funding out destination is bank.",
        );
      }

      destinationCurrency = tripBaseCurrency;
      destinationAmount = linkedAmountIn;
    }

    if (!linkedBankTransactionId && hasRequestedDestinationAmount && hasRequestedFxRate) {
      const derivedDestinationAmount = sourceAmount / fxRate;
      if (Math.abs(derivedDestinationAmount - destinationAmount) > 0.01) {
        throw new Error(
          "Funding out destination amount and FX rate are inconsistent with source amount.",
        );
      }
    }

    if (!(destinationAmount > 0)) {
      if (fxRate > 0) {
        destinationAmount = sourceAmount / fxRate;
      } else if (destinationType === "bank" && sourceBaseAmount > 0) {
        destinationAmount = sourceBaseAmount;
      } else {
        destinationAmount = sourceAmount;
      }
    }

    if (!(destinationAmount > 0)) {
      throw new Error("Funding out destination amount must be greater than 0.");
    }

    if (!(fxRate > 0)) {
      fxRate = sourceAmount / destinationAmount;
    }
    if (!(fxRate > 0)) {
      throw new Error("Funding out FX rate must be greater than 0.");
    }

    if (destinationType === "bank" && destinationCurrency !== tripBaseCurrency) {
      throw new Error(
        `Bank funding out destination currency must be ${tripBaseCurrency}.`,
      );
    }

    if (destinationType === "trip" && !destinationTripId) {
      throw new Error("Destination trip must be selected for trip funding out.");
    }

    return {
      destinationType,
      destinationTripId,
      bankTransactionId: linkedBankTransactionId,
      destinationCurrency,
      destinationAmount,
      fxRate,
      feeAmount,
      feeCurrency,
    };
  }

  private static deriveFundingEntrySourceType(input: {
    sourceType: string;
    bankTransactionId?: string | null;
  }) {
    if (input.bankTransactionId) return "funding_in_bank";

    switch (String(input.sourceType || "").toLowerCase()) {
      case "imported_topup":
        return "funding_in_imported_topup";
      case "opening_balance":
        return "funding_in_opening_balance";
      case "wallet_conversion":
        return "funding_in_wallet_conversion";
      case "from_trip_outgoing":
        return "funding_in_trip";
      default:
        return "funding_in_manual";
    }
  }

  private static deriveFundingEntryLabel(input: {
    sourceType: string;
    destinationCurrency: string;
    metadata: Record<string, unknown>;
  }) {
    const sourceType = String(input.sourceType || "").toLowerCase();

    if (typeof input.metadata.originalLabel === "string") {
      return input.metadata.originalLabel;
    }

    switch (sourceType) {
      case "imported_topup":
        return `Funding In · ${String(input.destinationCurrency || "").toUpperCase()}`;
      case "opening_balance":
        return "Opening Balance";
      case "wallet_conversion":
        return "Wallet Conversion In";
      case "from_trip_outgoing":
        return "Funding In from Trip";
      default:
        return "Funding In";
    }
  }

  private static deriveFundingEntryDescription(input: {
    sourceType: string;
    metadata: Record<string, unknown>;
    bankTransactionDescription?: string | null;
    walletName?: string | null;
    destinationCurrency: string;
  }) {
    if (typeof input.metadata.originalDescription === "string") {
      return input.metadata.originalDescription;
    }
    if (input.bankTransactionDescription) {
      return input.bankTransactionDescription;
    }

    const sourceType = String(input.sourceType || "").toLowerCase();
    switch (sourceType) {
      case "opening_balance":
        return `Opening balance for ${input.walletName || input.destinationCurrency}`;
      case "wallet_conversion":
        return `Wallet conversion into ${input.walletName || input.destinationCurrency}`;
      case "from_trip_outgoing":
        return typeof input.metadata.sourceTripDescription === "string"
          ? input.metadata.sourceTripDescription
          : `Funding imported from ${String(input.metadata.sourceTripName || "another trip")}`;
      case "imported_topup":
        return "Imported top-up";
      default:
        return `Funding into ${input.walletName || input.destinationCurrency}`;
    }
  }

  private static deriveFundingEntryDate(input: {
    metadata: Record<string, unknown>;
    bankTransactionDate?: Date | null;
    createdAt?: Date | null;
  }) {
    const parseDate = (value: unknown) => {
      if (!value) return null;
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    return (
      parseDate(input.metadata.originalDate) ||
      parseDate(input.metadata.basisTransactionDate) ||
      input.bankTransactionDate ||
      input.createdAt ||
      new Date()
    );
  }

  private static buildFundingEntryMetadata(input: {
    fundingId: string;
    sourceType: string;
    sourceCurrency: string;
    sourceAmount: number;
    destinationCurrency: string;
    destinationAmount: number;
    baseAmount: number;
    fxRate: number;
    feeAmount: number | null;
    feeCurrency: string | null;
    walletId?: string | null;
    walletName?: string | null;
    walletColor?: string | null;
    bankTransactionId?: string | null;
    bankTransactionDate?: Date | null;
    bankTransactionDescription?: string | null;
    bankTransactionAmountIn?: number | null;
    bankTransactionAmountOut?: number | null;
    metadata: Record<string, unknown>;
  }) {
    return {
      ...input.metadata,
      fundingId: input.fundingId,
      fundingDirection: "in",
      sourceType: TripRepository.deriveFundingEntrySourceType({
        sourceType: input.sourceType,
        bankTransactionId: input.bankTransactionId,
      }),
      fundingSourceType: input.sourceType,
      sourceCurrency: input.sourceCurrency,
      sourceAmount: input.sourceAmount,
      destinationCurrency: input.destinationCurrency,
      destinationAmount: input.destinationAmount,
      baseAmount: input.baseAmount,
      fxRate: input.fxRate,
      feeAmount: input.feeAmount,
      feeCurrency: input.feeCurrency,
      walletId: input.walletId ?? null,
      walletName: input.walletName ?? null,
      walletColor: input.walletColor ?? "#ffffff",
      bankTransactionId: input.bankTransactionId ?? null,
      bankTransactionDate: input.bankTransactionDate
        ? input.bankTransactionDate.toISOString()
        : null,
      bankTransactionDescription: input.bankTransactionDescription ?? null,
      bankTransactionAmountIn: input.bankTransactionAmountIn ?? null,
      bankTransactionAmountOut: input.bankTransactionAmountOut ?? null,
    } satisfies Record<string, unknown>;
  }

  private static async upsertFundingEntryTx(
    tx: Prisma.TransactionClient,
    userId: string,
    tripId: string,
    fundingId: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        entryId: string | null;
        walletId: string | null;
        sourceType: string;
        sourceCurrency: string;
        sourceAmount: unknown;
        destinationCurrency: string;
        destinationAmount: unknown;
        fxRate: unknown;
        baseAmount: unknown;
        feeAmount: unknown;
        feeCurrency: string | null;
        metadata: unknown;
        createdAt: Date;
        walletName: string | null;
        walletColor: string | null;
        bankTransactionId: string | null;
        bankTransactionDate: Date | null;
        bankTransactionDescription: string | null;
        bankTransactionAmountIn: unknown;
        bankTransactionAmountOut: unknown;
      }>
    >`
      SELECT
        tf.id,
        tf.entry_id AS "entryId",
        tf.wallet_id AS "walletId",
        tf.source_type AS "sourceType",
        tf.source_currency AS "sourceCurrency",
        tf.source_amount AS "sourceAmount",
        tf.destination_currency AS "destinationCurrency",
        tf.destination_amount AS "destinationAmount",
        tf.fx_rate AS "fxRate",
        tf.base_amount AS "baseAmount",
        tf.fee_amount AS "feeAmount",
        tf.fee_currency AS "feeCurrency",
        tf.metadata,
        tf.created_at AS "createdAt",
        w.name AS "walletName",
        w.color AS "walletColor",
        bt.id AS "bankTransactionId",
        bt.date AS "bankTransactionDate",
        bt.description AS "bankTransactionDescription",
        bt.amount_in AS "bankTransactionAmountIn",
        bt.amount_out AS "bankTransactionAmountOut"
      FROM trip_fundings tf
      INNER JOIN trips t ON t.id = tf.trip_id
      LEFT JOIN wallets w ON w.id = tf.wallet_id
      LEFT JOIN transactions bt ON bt.id = tf.bank_transaction_id
      WHERE tf.id = ${fundingId} AND tf.trip_id = ${tripId} AND t.user_id = ${userId}
      LIMIT 1
    `;

    const funding = rows[0];
    if (!funding) {
      throw new Error("Funding not found or unauthorized");
    }

    const metadata =
      funding.metadata && typeof funding.metadata === "object"
        ? { ...(funding.metadata as Record<string, unknown>) }
        : {};

    const localAmount = Number(funding.destinationAmount || 0);
    const baseAmount =
      funding.baseAmount !== null && funding.baseAmount !== undefined
        ? Number(funding.baseAmount)
        : Number(funding.sourceAmount || 0);
    const fxRate = localAmount > 0 ? baseAmount / localAmount : 1;
    const entryId = funding.entryId || randomUUID();
    const sourceType = TripRepository.deriveFundingEntrySourceType({
      sourceType: funding.sourceType,
      bankTransactionId: funding.bankTransactionId,
    });
    const entryMetadata = TripRepository.buildFundingEntryMetadata({
      fundingId: funding.id,
      sourceType: funding.sourceType,
      sourceCurrency: funding.sourceCurrency,
      sourceAmount: Number(funding.sourceAmount || 0),
      destinationCurrency: funding.destinationCurrency,
      destinationAmount: localAmount,
      baseAmount,
      fxRate,
      feeAmount:
        funding.feeAmount !== null && funding.feeAmount !== undefined
          ? Number(funding.feeAmount)
          : null,
      feeCurrency: funding.feeCurrency,
      walletId: funding.walletId,
      walletName: funding.walletName,
      walletColor: funding.walletColor,
      bankTransactionId: funding.bankTransactionId,
      bankTransactionDate: funding.bankTransactionDate,
      bankTransactionDescription: funding.bankTransactionDescription,
      bankTransactionAmountIn:
        funding.bankTransactionAmountIn !== null &&
        funding.bankTransactionAmountIn !== undefined
          ? Number(funding.bankTransactionAmountIn)
          : null,
      bankTransactionAmountOut:
        funding.bankTransactionAmountOut !== null &&
        funding.bankTransactionAmountOut !== undefined
          ? Number(funding.bankTransactionAmountOut)
          : null,
      metadata,
    });
    const date = TripRepository.deriveFundingEntryDate({
      metadata,
      bankTransactionDate: funding.bankTransactionDate,
      createdAt: funding.createdAt,
    });
    const label = TripRepository.deriveFundingEntryLabel({
      sourceType: funding.sourceType,
      destinationCurrency: funding.destinationCurrency,
      metadata,
    });
    const description = TripRepository.deriveFundingEntryDescription({
      sourceType: funding.sourceType,
      metadata,
      bankTransactionDescription: funding.bankTransactionDescription,
      walletName: funding.walletName,
      destinationCurrency: funding.destinationCurrency,
    });

    await tx.$executeRaw`
      INSERT INTO trip_entries (
        id,
        trip_id,
        wallet_id,
        source_type,
        source_transaction_id,
        type,
        transaction_date,
        description,
        label,
        local_currency,
        local_amount,
        fx_rate,
        base_amount,
        fee_amount,
        fee_currency,
        category_id,
        linked_entry_id,
        metadata,
        created_at
      )
      VALUES (
        ${entryId},
        ${tripId},
        ${funding.walletId},
        ${sourceType},
        ${funding.bankTransactionId},
        'funding_in',
        ${date},
        ${description},
        ${label},
        ${funding.destinationCurrency},
        ${localAmount},
        ${fxRate},
        ${baseAmount},
        ${null},
        ${null},
        NULL,
        NULL,
        ${entryMetadata as Prisma.InputJsonValue},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        wallet_id = EXCLUDED.wallet_id,
        source_type = EXCLUDED.source_type,
        source_transaction_id = EXCLUDED.source_transaction_id,
        type = EXCLUDED.type,
        transaction_date = EXCLUDED.transaction_date,
        description = EXCLUDED.description,
        label = EXCLUDED.label,
        local_currency = EXCLUDED.local_currency,
        local_amount = EXCLUDED.local_amount,
        fx_rate = EXCLUDED.fx_rate,
        base_amount = EXCLUDED.base_amount,
        fee_amount = EXCLUDED.fee_amount,
        fee_currency = EXCLUDED.fee_currency,
        metadata = EXCLUDED.metadata
    `;

    await tx.$executeRaw`
      UPDATE trip_fundings
      SET entry_id = ${entryId}
      WHERE id = ${fundingId} AND trip_id = ${tripId}
    `;

    return entryId;
  }

  private static async deleteFundingEntryTx(
    tx: Prisma.TransactionClient,
    tripId: string,
    fundingId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ entryId: string | null }>>`
      SELECT entry_id AS "entryId"
      FROM trip_fundings
      WHERE id = ${fundingId} AND trip_id = ${tripId}
      LIMIT 1
    `;
    const entryId = rows[0]?.entryId;
    if (!entryId) return;

    await tx.$executeRaw`
      DELETE FROM trip_entries
      WHERE id = ${entryId} AND trip_id = ${tripId}
    `;
  }

  private static mapTrip(row: any) {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      coverImageUrl: row.coverImageUrl ?? null,
      baseCurrency: row.baseCurrency,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private static mapWallet(row: any) {
    return {
      id: row.id,
      tripId: row.tripId,
      name: row.name,
      currency: row.currency,
      color: row.color ?? "#60a5fa",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private static mapFunding(row: any) {
    return {
      id: row.id,
      tripId: row.tripId,
      walletId: row.walletId,
      entryId: row.entryId ?? null,
      bankTransactionId: row.bankTransactionId,
      sourceType: row.sourceType,
      sourceCurrency: row.sourceCurrency,
      sourceAmount: row.sourceAmount,
      destinationCurrency: row.destinationCurrency,
      destinationAmount: row.destinationAmount,
      fxRate: row.fxRate,
      baseAmount: row.baseAmount,
      feeAmount: row.feeAmount,
      feeCurrency: row.feeCurrency,
      metadata: row.metadata,
      createdAt: row.createdAt,
      wallet: row.walletId
        ? {
            id: row.walletId,
            name: row.walletName,
            currency: row.walletCurrency,
            color: row.walletColor ?? "#60a5fa",
          }
        : null,
      bankTransaction: row.bankTransactionId
        ? {
            id: row.bankTransactionId,
            date: row.bankTransactionDate,
            description: row.bankTransactionDescription,
            amountIn: row.bankTransactionAmountIn,
            amountOut: row.bankTransactionAmountOut,
          }
        : null,
      suggestedBankTransaction: row.suggestedBankTransactionId
        ? {
            id: row.suggestedBankTransactionId,
            date: row.suggestedBankTransactionDate,
            description: row.suggestedBankTransactionDescription,
            amountIn: row.suggestedBankTransactionAmountIn,
            amountOut: row.suggestedBankTransactionAmountOut,
          }
        : null,
      trip: {
        id: row.tripId,
        name: row.tripName,
      },
    };
  }

  private static async syncLinkedFundingBaseAmountsFromWalletOutflows(
    userId: string,
    tripId: string,
    walletId: string,
  ) {
    const rows = await prisma.$queryRaw<
      Array<{ tripId: string; walletId: string | null }>
    >`
      UPDATE trip_fundings tf
      SET base_amount = te.base_amount
      FROM trip_entries te
      INNER JOIN trips source_trip ON source_trip.id = te.trip_id
      INNER JOIN trips destination_trip ON destination_trip.id = tf.trip_id
      WHERE
        tf.source_type IN ('from_trip_outgoing', 'wallet_conversion')
        AND COALESCE(tf.metadata->>'sourceTripEntryId', '') = te.id
        AND te.trip_id = ${tripId}
        AND te.wallet_id = ${walletId}
        AND te.type = 'funding_out'
        AND source_trip.user_id = ${userId}
        AND destination_trip.user_id = ${userId}
        AND (
          tf.base_amount IS NULL
          OR ABS(tf.base_amount - te.base_amount) > 0.0001
        )
      RETURNING tf.trip_id AS "tripId", tf.wallet_id AS "walletId"
    `;

    const downstreamWallets = Array.from(
      new Map(
        rows
          .filter(
            (row): row is { tripId: string; walletId: string } =>
              Boolean(row.tripId && row.walletId),
          )
          .map((row) => [`${row.tripId}:${row.walletId}`, row]),
      ).values(),
    );

    return {
      downstreamWallets,
      updatedFundingCount: rows.length,
    };
  }

  private static async propagateFundingBaseAmountsAcrossTrips(
    userId: string,
    seedWallets: Array<{ tripId: string; walletId: string }>,
  ): Promise<PropagationTrace> {
    const startedAt = new Date().toISOString();
    const traceSteps: PropagationTraceStep[] = [];
    let totalWalletRecalculations = 0;
    let totalFundingRowsUpdated = 0;
    let truncated = false;

    const queue: Array<{ tripId: string; walletId: string; recalculate: boolean }> =
      seedWallets
        .filter((item) => item.tripId && item.walletId)
        .map((item) => ({
          tripId: item.tripId,
          walletId: item.walletId,
          recalculate: false,
        }));

    const seenIterations = new Map<string, number>();
    let iterationBudget = 400;

    while (queue.length > 0 && iterationBudget > 0) {
      iterationBudget -= 1;
      const current = queue.shift()!;
      const key = `${current.tripId}:${current.walletId}:${current.recalculate ? "1" : "0"}`;
      const seen = seenIterations.get(key) || 0;
      if (seen >= 6) {
        continue;
      }
      seenIterations.set(key, seen + 1);

      if (current.recalculate) {
        const recalcResult = await TripRepository.recalculateWalletEntriesToBase(
          userId,
          current.tripId,
          current.walletId,
          { mode: "weighted" },
          false,
        ).catch(() => null);
        totalWalletRecalculations += 1;
        traceSteps.push({
          phase: "recalculate_wallet",
          tripId: current.tripId,
          walletId: current.walletId,
          updatedEntryCount: recalcResult?.updatedCount ?? 0,
        });
      }

      const syncResult = await TripRepository.syncLinkedFundingBaseAmountsFromWalletOutflows(
        userId,
        current.tripId,
        current.walletId,
      );
      totalFundingRowsUpdated += syncResult.updatedFundingCount;
      traceSteps.push({
        phase: "sync_linked_fundings",
        tripId: current.tripId,
        walletId: current.walletId,
        updatedFundingCount: syncResult.updatedFundingCount,
        queuedWallets: syncResult.downstreamWallets,
      });

      for (const wallet of syncResult.downstreamWallets) {
        queue.push({
          tripId: wallet.tripId,
          walletId: wallet.walletId,
          recalculate: true,
        });
      }
    }

    if (iterationBudget <= 0) {
      truncated = true;
    }

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      seedWallets,
      totalWalletRecalculations,
      totalFundingRowsUpdated,
      steps: traceSteps,
      truncated,
    };
  }

  private static roundMoney(value: number) {
    return Number(value.toFixed(4));
  }

  private static parseTripEntryLinkage(raw: unknown): TripEntryLinkage | null {
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Record<string, unknown>;
    const type = String(candidate.type || "").toLowerCase();
    if (type !== "reimbursement" && type !== "reimbursed") return null;
    return {
      type,
      reimbursesAllocations: Array.isArray(candidate.reimbursesAllocations)
        ? (candidate.reimbursesAllocations as TripEntryLinkage["reimbursesAllocations"])
        : undefined,
      reimbursedByAllocations: Array.isArray(candidate.reimbursedByAllocations)
        ? (candidate.reimbursedByAllocations as TripEntryLinkage["reimbursedByAllocations"])
        : undefined,
      leftoverBaseAmount:
        candidate.leftoverBaseAmount !== undefined
          ? Number(candidate.leftoverBaseAmount)
          : undefined,
      leftoverCategoryId:
        candidate.leftoverCategoryId === null ||
        candidate.leftoverCategoryId === undefined
          ? null
          : String(candidate.leftoverCategoryId),
    };
  }

  private static normalizeTripReimbursementAllocations(
    allocations: TripReimbursementAllocationInput[],
  ) {
    const byTargetKey = new Map<string, number>();
    for (const item of allocations || []) {
      const amountBase = Number(item.amountBase || 0);
      if (!(amountBase > 0)) continue;
      const key = item.transactionId
        ? `tx:${item.transactionId}`
        : typeof item.pendingBatchIndex === "number"
          ? `batch:${item.pendingBatchIndex}`
          : "";
      if (!key) continue;
      byTargetKey.set(
        key,
        Number(((byTargetKey.get(key) || 0) + amountBase).toFixed(4)),
      );
    }
    return Array.from(byTargetKey.entries()).map(([key, amountBase]) => {
      if (key.startsWith("tx:")) {
        return { transactionId: key.slice(3), amountBase };
      }
      return { pendingBatchIndex: Number(key.slice(6)), amountBase };
    });
  }

  private static async getTripTargetReimbursementCapacityBase(
    tx: Prisma.TransactionClient,
    tripId: string,
    reimbursedEntryId: string,
    excludeReimbursementEntryId?: string,
  ) {
    const [target] = await tx.$queryRaw<Array<{ baseAmount: unknown; type: string }>>`
      SELECT base_amount AS "baseAmount", type
      FROM trip_entries
      WHERE id = ${reimbursedEntryId} AND trip_id = ${tripId}
      LIMIT 1
    `;
    if (!target) {
      throw new Error(`Target trip entry ${reimbursedEntryId} not found`);
    }
    if (target.type !== "spending") {
      throw new Error("Only spending trip entries can be reimbursed");
    }

    const [allocated] = await tx.$queryRaw<Array<{ allocated: unknown }>>`
      SELECT COALESCE(SUM(amount_base), 0) AS allocated
      FROM trip_reimbursement_allocations
      WHERE
        trip_id = ${tripId}
        AND reimbursed_entry_id = ${reimbursedEntryId}
        AND (${excludeReimbursementEntryId || null}::text IS NULL OR reimbursement_entry_id <> ${excludeReimbursementEntryId || null})
    `;
    const targetBase = Number(target.baseAmount || 0);
    const allocatedBase = Number(allocated?.allocated || 0);
    return {
      targetBase,
      allocatedBase,
      remainingBase: Number(Math.max(targetBase - allocatedBase, 0).toFixed(4)),
    };
  }

  private static async applyTripReimbursementAllocations(
    tx: Prisma.TransactionClient,
    tripId: string,
    reimbursementEntryId: string,
    allocations: Array<{ transactionId: string; amountBase: number }>,
    leftoverCategoryId?: string | null,
    valuation?: {
      reimbursementBaseAmount?: number | null;
      reimbursingFxRate?: number | null;
    },
  ) {
    const [reimbursementRow] = await tx.$queryRaw<
      Array<{
        id: string;
        type: string;
        baseAmount: unknown;
        localAmount: unknown;
        localCurrency: string;
        fxRate: unknown;
        metadata: unknown;
      }>
    >`
      SELECT
        id,
        type,
        base_amount AS "baseAmount",
        local_amount AS "localAmount",
        local_currency AS "localCurrency",
        fx_rate AS "fxRate",
        metadata
      FROM trip_entries
      WHERE id = ${reimbursementEntryId} AND trip_id = ${tripId}
      LIMIT 1
    `;
    if (!reimbursementRow) {
      throw new Error("Reimbursement entry not found");
    }
    if (reimbursementRow.type !== "reimbursement") {
      throw new Error("Only reimbursement entries can reimburse other entries");
    }

    const reimbursementLocalAmount = Number(reimbursementRow.localAmount || 0);
    const requestedBaseAmount =
      valuation?.reimbursementBaseAmount === null ||
      valuation?.reimbursementBaseAmount === undefined
        ? null
        : Number(valuation.reimbursementBaseAmount);
    const requestedFxRate =
      valuation?.reimbursingFxRate === null ||
      valuation?.reimbursingFxRate === undefined
        ? null
        : Number(valuation.reimbursingFxRate);

    if (requestedBaseAmount !== null && !(requestedBaseAmount > 0)) {
      throw new Error("Reimbursement base amount must be greater than 0");
    }
    if (requestedFxRate !== null && !(requestedFxRate > 0)) {
      throw new Error("Reimbursement FX rate must be greater than 0");
    }
    if (requestedFxRate !== null && !(reimbursementLocalAmount > 0)) {
      throw new Error(
        "Cannot apply reimbursement FX rate because local amount is not greater than 0",
      );
    }
    if (
      requestedBaseAmount !== null &&
      requestedFxRate !== null &&
      reimbursementLocalAmount > 0 &&
      Math.abs(requestedBaseAmount - reimbursementLocalAmount * requestedFxRate) > 0.01
    ) {
      throw new Error(
        "Reimbursement base amount and FX rate are inconsistent with local amount",
      );
    }

    let reimbursementBase = Number(reimbursementRow.baseAmount || 0);
    if (requestedBaseAmount !== null) {
      reimbursementBase = requestedBaseAmount;
    } else if (requestedFxRate !== null && reimbursementLocalAmount > 0) {
      reimbursementBase = reimbursementLocalAmount * requestedFxRate;
    }

    let reimbursementFxRate =
      reimbursementLocalAmount > 0
        ? reimbursementBase / reimbursementLocalAmount
        : Number(reimbursementRow.fxRate || 1) || 1;
    if (requestedFxRate !== null) {
      reimbursementFxRate = requestedFxRate;
    }

    if (
      requestedBaseAmount !== null ||
      requestedFxRate !== null ||
      Math.abs(Number(reimbursementRow.baseAmount || 0) - reimbursementBase) > 0.0001 ||
      Math.abs((Number(reimbursementRow.fxRate || 1) || 1) - reimbursementFxRate) > 0.0001
    ) {
      await tx.$executeRaw`
        UPDATE trip_entries
        SET
          base_amount = ${TripRepository.roundMoney(reimbursementBase)},
          fx_rate = ${TripRepository.roundMoney(reimbursementFxRate)}
        WHERE id = ${reimbursementEntryId} AND trip_id = ${tripId}
      `;
    }

    if (!(reimbursementBase > 0)) {
      throw new Error("Reimbursement entry has no allocatable base amount");
    }
    const reimbursingLocalAmount = reimbursementLocalAmount;
    const reimbursingFxRate = reimbursementFxRate;

    const normalized = TripRepository.normalizeTripReimbursementAllocations(
      allocations.map((item) => ({
        transactionId: item.transactionId,
        amountBase: item.amountBase,
      })),
    ).filter(
      (item): item is { transactionId: string; amountBase: number } =>
        !!item.transactionId && item.amountBase > 0,
    );

    const totalRequestedBase = normalized.reduce(
      (sum, item) => sum + item.amountBase,
      0,
    );
    if (totalRequestedBase - reimbursementBase > 0.0001) {
      throw new Error(
        "Total reimbursed base amount cannot exceed reimbursement base amount",
      );
    }

    await tx.$executeRaw`
      DELETE FROM trip_reimbursement_allocations
      WHERE trip_id = ${tripId} AND reimbursement_entry_id = ${reimbursementEntryId}
    `;

    for (const item of normalized) {
      if (item.transactionId === reimbursementEntryId) {
        throw new Error("A trip entry cannot reimburse itself");
      }

      const capacity = await TripRepository.getTripTargetReimbursementCapacityBase(
        tx,
        tripId,
        item.transactionId,
        reimbursementEntryId,
      );
      if (item.amountBase - capacity.remainingBase > 0.0001) {
        throw new Error(
          `Reimbursed base amount exceeds remaining amount for entry ${item.transactionId}`,
        );
      }

      const [target] = await tx.$queryRaw<
        Array<{
          baseAmount: unknown;
          localAmount: unknown;
          localCurrency: string;
          fxRate: unknown;
          metadata: unknown;
        }>
      >`
        SELECT
          base_amount AS "baseAmount",
          local_amount AS "localAmount",
          local_currency AS "localCurrency",
          fx_rate AS "fxRate",
          metadata
        FROM trip_entries
        WHERE id = ${item.transactionId} AND trip_id = ${tripId}
        LIMIT 1
      `;
      if (!target) {
        throw new Error("Reimbursed entry not found");
      }

      const reimbursedLocalAmountRaw = Number(target.localAmount || 0);
      const reimbursedBaseAmountRaw = Number(target.baseAmount || 0);
      const reimbursedFxRate =
        reimbursedLocalAmountRaw > 0
          ? reimbursedBaseAmountRaw / reimbursedLocalAmountRaw
          : Number(target.fxRate || 1) || 1;
      const reimbursingLocalUsed =
        reimbursingFxRate > 0 ? item.amountBase / reimbursingFxRate : 0;
      const reimbursedLocalCovered =
        reimbursedFxRate > 0 ? item.amountBase / reimbursedFxRate : 0;

      await tx.$executeRaw`
        INSERT INTO trip_reimbursement_allocations (
          id,
          trip_id,
          reimbursement_entry_id,
          reimbursed_entry_id,
          amount_base,
          reimbursing_local_amount,
          reimbursed_local_amount,
          reimbursing_fx_rate,
          reimbursed_fx_rate,
          created_at
        )
        VALUES (
          ${randomUUID()},
          ${tripId},
          ${reimbursementEntryId},
          ${item.transactionId},
          ${TripRepository.roundMoney(item.amountBase)},
          ${TripRepository.roundMoney(reimbursingLocalUsed)},
          ${TripRepository.roundMoney(reimbursedLocalCovered)},
          ${TripRepository.roundMoney(reimbursingFxRate)},
          ${TripRepository.roundMoney(reimbursedFxRate)},
          NOW()
        )
      `;
    }

    const [allocationRows] = await Promise.all([
      tx.$queryRaw<
        Array<{
          reimbursedEntryId: string;
          amountBase: unknown;
          reimbursingLocalAmount: unknown;
          reimbursedLocalAmount: unknown;
          reimbursingFxRate: unknown;
          reimbursedFxRate: unknown;
          reimbursedCurrency: string;
        }>
      >`
        SELECT
          a.reimbursed_entry_id AS "reimbursedEntryId",
          a.amount_base AS "amountBase",
          a.reimbursing_local_amount AS "reimbursingLocalAmount",
          a.reimbursed_local_amount AS "reimbursedLocalAmount",
          a.reimbursing_fx_rate AS "reimbursingFxRate",
          a.reimbursed_fx_rate AS "reimbursedFxRate",
          te.local_currency AS "reimbursedCurrency"
        FROM trip_reimbursement_allocations a
        INNER JOIN trip_entries te ON te.id = a.reimbursed_entry_id
        WHERE a.trip_id = ${tripId} AND a.reimbursement_entry_id = ${reimbursementEntryId}
      `,
    ]);

    const allocatedBase = allocationRows.reduce(
      (sum, row) => sum + Number(row.amountBase || 0),
      0,
    );
    const reimbursementMetadata =
      reimbursementRow.metadata && typeof reimbursementRow.metadata === "object"
        ? { ...(reimbursementRow.metadata as Record<string, unknown>) }
        : {};
    reimbursementMetadata.linkage = {
      type: "reimbursement",
      reimbursesAllocations: allocationRows.map((row) => ({
        transactionId: row.reimbursedEntryId,
        amountBase: Number(row.amountBase || 0),
        reimbursingLocalAmount: Number(row.reimbursingLocalAmount || 0),
        reimbursedLocalAmount: Number(row.reimbursedLocalAmount || 0),
        reimbursingCurrency: reimbursementRow.localCurrency,
        reimbursedCurrency: row.reimbursedCurrency,
        reimbursingFxRate: Number(row.reimbursingFxRate || 0),
        reimbursedFxRate: Number(row.reimbursedFxRate || 0),
      })),
      leftoverBaseAmount: Number(
        Math.max(reimbursementBase - allocatedBase, 0).toFixed(4),
      ),
      leftoverCategoryId: leftoverCategoryId ?? null,
    } as TripEntryLinkage;

    await tx.$executeRaw`
      UPDATE trip_entries
      SET metadata = ${reimbursementMetadata as Prisma.InputJsonValue}
      WHERE id = ${reimbursementEntryId} AND trip_id = ${tripId}
    `;

    const impactedTargetIds = Array.from(
      new Set(allocationRows.map((row) => row.reimbursedEntryId)),
    );
    for (const targetId of impactedTargetIds) {
      const targetMetadataRow = await tx.$queryRaw<Array<{ metadata: unknown; localCurrency: string }>>`
        SELECT metadata, local_currency AS "localCurrency"
        FROM trip_entries
        WHERE id = ${targetId} AND trip_id = ${tripId}
        LIMIT 1
      `;
      const targetMetadata =
        targetMetadataRow[0]?.metadata &&
        typeof targetMetadataRow[0].metadata === "object"
          ? { ...(targetMetadataRow[0].metadata as Record<string, unknown>) }
          : {};
      const targetAllocRows = await tx.$queryRaw<
        Array<{
          reimbursementEntryId: string;
          amountBase: unknown;
          reimbursingLocalAmount: unknown;
          reimbursedLocalAmount: unknown;
          reimbursingFxRate: unknown;
          reimbursedFxRate: unknown;
          reimbursingCurrency: string;
        }>
      >`
        SELECT
          a.reimbursement_entry_id AS "reimbursementEntryId",
          a.amount_base AS "amountBase",
          a.reimbursing_local_amount AS "reimbursingLocalAmount",
          a.reimbursed_local_amount AS "reimbursedLocalAmount",
          a.reimbursing_fx_rate AS "reimbursingFxRate",
          a.reimbursed_fx_rate AS "reimbursedFxRate",
          re.local_currency AS "reimbursingCurrency"
        FROM trip_reimbursement_allocations a
        INNER JOIN trip_entries re ON re.id = a.reimbursement_entry_id
        WHERE a.trip_id = ${tripId} AND a.reimbursed_entry_id = ${targetId}
      `;

      targetMetadata.linkage =
        targetAllocRows.length > 0
          ? ({
              type: "reimbursed",
              reimbursedByAllocations: targetAllocRows.map((row) => ({
                transactionId: row.reimbursementEntryId,
                amountBase: Number(row.amountBase || 0),
                reimbursingLocalAmount: Number(row.reimbursingLocalAmount || 0),
                reimbursedLocalAmount: Number(row.reimbursedLocalAmount || 0),
                reimbursingCurrency: row.reimbursingCurrency,
                reimbursedCurrency: targetMetadataRow[0]?.localCurrency,
                reimbursingFxRate: Number(row.reimbursingFxRate || 0),
                reimbursedFxRate: Number(row.reimbursedFxRate || 0),
              })),
            } satisfies TripEntryLinkage)
          : null;

      await tx.$executeRaw`
        UPDATE trip_entries
        SET metadata = ${targetMetadata as Prisma.InputJsonValue}
        WHERE id = ${targetId} AND trip_id = ${tripId}
      `;
    }
  }

  static async createTrip(userId: string, data: {
    name: string;
    coverImageUrl?: string | null;
    baseCurrency: string;
    startDate: Date;
    endDate?: Date | null;
    status?: string;
    notes?: string | null;
  }) {
    const baseCurrency = await TripRepository.getUserBaseCurrency(userId);
    const id = randomUUID();
    const [trip] = await prisma.$queryRaw<any[]>`
      INSERT INTO trips (
        id,
        user_id,
        name,
        cover_image_url,
        base_currency,
        start_date,
        end_date,
        status,
        notes,
        created_at,
        updated_at
      )
      VALUES (
        ${id},
        ${userId},
        ${data.name},
        ${data.coverImageUrl ?? null},
        ${baseCurrency},
        ${data.startDate},
        ${data.endDate ?? null},
        ${data.status ?? "active"},
        ${data.notes ?? null},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        user_id AS "userId",
        name,
        cover_image_url AS "coverImageUrl",
        base_currency AS "baseCurrency",
        start_date AS "startDate",
        end_date AS "endDate",
        status,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    return TripRepository.mapTrip(trip);
  }

  static async findMany(userId: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        user_id AS "userId",
        name,
        cover_image_url AS "coverImageUrl",
        base_currency AS "baseCurrency",
        start_date AS "startDate",
        end_date AS "endDate",
        status,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM trips
      WHERE user_id = ${userId}
      ORDER BY start_date DESC
    `;
    return rows.map(TripRepository.mapTrip);
  }

  static async findById(userId: string, tripId: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        user_id AS "userId",
        name,
        cover_image_url AS "coverImageUrl",
        base_currency AS "baseCurrency",
        start_date AS "startDate",
        end_date AS "endDate",
        status,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    return rows[0] ? TripRepository.mapTrip(rows[0]) : null;
  }

  static async updateTrip(
    userId: string,
    tripId: string,
    data: {
      name?: string;
      coverImageUrl?: string | null;
      baseCurrency?: string;
      startDate?: Date;
      endDate?: Date | null;
      status?: string;
      notes?: string | null;
    },
  ) {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!existing[0]) {
      throw new Error("Trip not found or unauthorized");
    }

    const baseCurrency = await TripRepository.getUserBaseCurrency(userId);

    const [trip] = await prisma.$queryRaw<any[]>`
      UPDATE trips
      SET
        name = COALESCE(${data.name ?? null}, name),
        cover_image_url = ${data.coverImageUrl === undefined ? Prisma.sql`cover_image_url` : data.coverImageUrl},
        base_currency = ${baseCurrency},
        start_date = COALESCE(${data.startDate ?? null}, start_date),
        end_date = ${data.endDate === undefined ? Prisma.sql`end_date` : data.endDate},
        status = COALESCE(${data.status ?? null}, status),
        notes = ${data.notes === undefined ? Prisma.sql`notes` : data.notes},
        updated_at = NOW()
      WHERE id = ${tripId} AND user_id = ${userId}
      RETURNING
        id,
        user_id AS "userId",
        name,
        cover_image_url AS "coverImageUrl",
        base_currency AS "baseCurrency",
        start_date AS "startDate",
        end_date AS "endDate",
        status,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    return TripRepository.mapTrip(trip);
  }

  static async deleteTrip(userId: string, tripId: string) {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!existing[0]) {
      throw new Error("Trip not found or unauthorized");
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM trip_entries
        WHERE trip_id = ${tripId}
      `;
      await tx.$executeRaw`
        DELETE FROM trip_fundings
        WHERE trip_id = ${tripId}
      `;
      await tx.$executeRaw`
        DELETE FROM wallets
        WHERE trip_id = ${tripId}
      `;
      await tx.$executeRaw`
        DELETE FROM trips
        WHERE id = ${tripId} AND user_id = ${userId}
      `;
    });

    return { success: true };
  }

  static async getFundingsByTrip(userId: string, tripId: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        tf.id,
        tf.trip_id AS "tripId",
        tf.wallet_id AS "walletId",
        tf.entry_id AS "entryId",
        tf.bank_transaction_id AS "bankTransactionId",
        tf.source_type AS "sourceType",
        tf.source_currency AS "sourceCurrency",
        tf.source_amount AS "sourceAmount",
        tf.destination_currency AS "destinationCurrency",
        tf.destination_amount AS "destinationAmount",
        tf.fx_rate AS "fxRate",
        tf.base_amount AS "baseAmount",
        tf.fee_amount AS "feeAmount",
        tf.fee_currency AS "feeCurrency",
        tf.metadata,
        tf.created_at AS "createdAt",
        t.name AS "tripName",
        w.name AS "walletName",
        w.currency AS "walletCurrency",
        w.color AS "walletColor",
        bt.date AS "bankTransactionDate",
        bt.description AS "bankTransactionDescription",
        bt.amount_in AS "bankTransactionAmountIn",
        bt.amount_out AS "bankTransactionAmountOut",
        sbt.id AS "suggestedBankTransactionId",
        sbt.date AS "suggestedBankTransactionDate",
        sbt.description AS "suggestedBankTransactionDescription",
        sbt.amount_in AS "suggestedBankTransactionAmountIn",
        sbt.amount_out AS "suggestedBankTransactionAmountOut"
      FROM trip_fundings tf
      INNER JOIN trips t ON t.id = tf.trip_id
      LEFT JOIN wallets w ON w.id = tf.wallet_id
      LEFT JOIN transactions bt ON bt.id = tf.bank_transaction_id
      LEFT JOIN transactions sbt ON sbt.id = NULLIF(tf.metadata->>'autoMatchedBankTransactionId', '')
      WHERE tf.trip_id = ${tripId} AND t.user_id = ${userId}
      ORDER BY tf.created_at DESC
    `;
    return rows.map(TripRepository.mapFunding);
  }

  static async createFunding(userId: string, input: {
    tripId: string;
    walletId?: string | null;
    bankTransactionId?: string | null;
    sourceType: string;
    sourceCurrency: string;
    sourceAmount: number;
    destinationCurrency: string;
    destinationAmount: number;
    fxRate?: number | null;
    feeAmount?: number | null;
    feeCurrency?: string | null;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const id = randomUUID();
    const trip = await prisma.$queryRaw<Array<{ id: string; baseCurrency: string }>>`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${input.tripId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (!trip[0]) {
      throw new Error("Trip not found or unauthorized");
    }

    let bankTransactionDate: Date | null = null;
    let bankTransactionAmountOut: number | null = null;
    let bankTransactionCurrency: string | null = null;
    if (input.bankTransactionId) {
      const transaction = await prisma.$queryRaw<
      Array<{
        id: string;
        date: Date;
        description: string;
        amountOut: unknown;
        currency: string | null;
      }>
      >`
        SELECT
          id,
          date,
          description,
          amount_out AS "amountOut",
          currency
        FROM transactions
        WHERE id = ${input.bankTransactionId} AND user_id = ${userId}
        LIMIT 1
      `;
      if (!transaction[0]) {
        throw new Error("Bank transaction not found or unauthorized");
      }
      const txAmountOut = Number(transaction[0].amountOut || 0);
      if (!(txAmountOut > 0)) {
        throw new Error(
          "Linked bank transaction must be a debit (amount out) for funding in.",
        );
      }
      const txCurrency = String(transaction[0].currency || trip[0].baseCurrency).toUpperCase();
      if (Math.abs(Number(input.sourceAmount || 0) - txAmountOut) > 0.01) {
        throw new Error(
          "Source amount must match the linked bank transaction amount out.",
        );
      }
      if (
        String(input.sourceCurrency || txCurrency).toUpperCase() !== txCurrency
      ) {
        throw new Error(
          "Source currency must match the linked bank transaction currency.",
        );
      }
      bankTransactionDate = transaction[0].date;
      bankTransactionAmountOut = txAmountOut;
      bankTransactionCurrency = txCurrency;
    }

    let walletCurrency: string | null = null;
    if (input.walletId) {
      const wallet = await prisma.$queryRaw<Array<{ id: string; currency: string }>>`
        SELECT w.id
        , w.currency
        FROM wallets w
        INNER JOIN trips t ON t.id = w.trip_id
        WHERE
          w.id = ${input.walletId}
          AND w.trip_id = ${input.tripId}
          AND t.user_id = ${userId}
        LIMIT 1
      `;
      if (!wallet[0]) {
        throw new Error("Wallet not found or unauthorized");
      }
      walletCurrency = String(wallet[0].currency || "").toUpperCase();
    }

    if (
      input.bankTransactionId &&
      walletCurrency &&
      String(input.destinationCurrency || walletCurrency).toUpperCase() !== walletCurrency
    ) {
      throw new Error(
        "Destination currency must match the destination wallet currency for bank-linked funding.",
      );
    }

    const metadata: Record<string, unknown> =
      input.metadata && typeof input.metadata === "object"
        ? { ...(input.metadata as Record<string, unknown>) }
        : {};
    if (typeof metadata.matchReviewStatus !== "string") {
      metadata.matchReviewStatus =
        input.sourceType === "imported_topup" ? "pending" : "confirmed";
    }

    const normalized = TripRepository.normalizeFundingValues({
      sourceCurrency: bankTransactionCurrency || input.sourceCurrency,
      sourceAmount: bankTransactionAmountOut ?? input.sourceAmount,
      destinationCurrency:
        input.bankTransactionId && walletCurrency
          ? walletCurrency
          : input.destinationCurrency,
      destinationAmount: input.destinationAmount,
      fxRate: input.fxRate ?? null,
      feeAmount: input.feeAmount ?? null,
      feeCurrency: input.feeCurrency ?? null,
      baseCurrency: trip[0].baseCurrency,
    });

    const [row] = await prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<any[]>`
        INSERT INTO trip_fundings (
          id,
          trip_id,
          wallet_id,
          entry_id,
          bank_transaction_id,
          source_type,
          source_currency,
          source_amount,
          destination_currency,
          destination_amount,
          fx_rate,
          base_amount,
          fee_amount,
          fee_currency,
          metadata,
          created_at
        )
        VALUES (
          ${id},
          ${input.tripId},
          ${input.walletId ?? null},
          NULL,
          ${input.bankTransactionId ?? null},
          ${input.sourceType},
          ${normalized.sourceCurrency},
          ${normalized.sourceAmount},
          ${normalized.destinationCurrency},
          ${normalized.destinationAmount},
          ${normalized.fxRate},
          ${normalized.baseAmount},
          ${normalized.feeAmount},
          ${normalized.feeCurrency},
          ${metadata as Prisma.InputJsonValue},
          NOW()
        )
        RETURNING id
      `;

      await TripRepository.upsertFundingEntryTx(tx, userId, input.tripId, id);
      return inserted;
    });

    let propagationTrace: PropagationTrace | null = null;
    if (input.walletId) {
      const recalcResult = await TripRepository.recalculateWalletEntriesToBase(
        userId,
        input.tripId,
        input.walletId,
        {
          mode: "weighted",
        },
      ).catch(() => null);
      propagationTrace = recalcResult?.propagationTrace ?? null;
    }

    const created = await TripRepository.getFundingsByTrip(userId, input.tripId);
    const match = created.find((item) => item.id === row.id);
    if (!match) {
      throw new Error("Failed to create funding");
    }
    return {
      funding: match,
      propagationTrace,
    };
  }

  static async reviewFundingMatch(
    userId: string,
    tripId: string,
    fundingId: string,
    input: {
      action: "accept" | "reject" | "replace";
      bankTransactionId?: string | null;
    },
  ) {
    const fundingRows = await prisma.$queryRaw<
      Array<{
        id: string;
        sourceType: string;
        bankTransactionId: string | null;
        metadata: unknown;
      }>
    >`
      SELECT
        tf.id,
        tf.source_type AS "sourceType",
        tf.bank_transaction_id AS "bankTransactionId",
        tf.metadata
      FROM trip_fundings tf
      INNER JOIN trips t ON t.id = tf.trip_id
      WHERE
        tf.id = ${fundingId}
        AND tf.trip_id = ${tripId}
        AND t.user_id = ${userId}
      LIMIT 1
    `;

    const funding = fundingRows[0];
    if (!funding) {
      throw new Error("Funding not found or unauthorized");
    }

    const metadata: Record<string, unknown> =
      funding.metadata && typeof funding.metadata === "object"
        ? { ...(funding.metadata as Record<string, unknown>) }
        : {};

    const validateTransactionOwnership = async (transactionId: string) => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM transactions
        WHERE id = ${transactionId} AND user_id = ${userId}
        LIMIT 1
      `;
      if (!rows[0]) {
        throw new Error("Selected bank transaction not found or unauthorized");
      }
    };

    const ensureNotAlreadyLinked = async (transactionId: string) => {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM trip_fundings
        WHERE
          trip_id = ${tripId}
          AND bank_transaction_id = ${transactionId}
          AND id <> ${fundingId}
        LIMIT 1
      `;
      if (rows[0]) {
        throw new Error("Selected transaction is already linked to another funding source.");
      }
    };

    let nextBankTransactionId: string | null = funding.bankTransactionId;

    if (funding.sourceType === "opening_balance") {
      if (input.action === "replace") {
        throw new Error("Opening balance suggestions do not support replace linkage.");
      }
      nextBankTransactionId = null;
      metadata.matchReviewStatus = input.action === "accept" ? "accepted" : "rejected";
      metadata.matchReviewedAction = input.action;
    } else if (input.action === "accept") {
      const suggestedId =
        typeof metadata.autoMatchedBankTransactionId === "string"
          ? metadata.autoMatchedBankTransactionId
          : null;
      const selectedId = input.bankTransactionId || suggestedId;
      if (!selectedId) {
        throw new Error("No suggested transaction available to accept.");
      }
      await validateTransactionOwnership(selectedId);
      await ensureNotAlreadyLinked(selectedId);
      nextBankTransactionId = selectedId;
      metadata.matchReviewStatus = "accepted";
      metadata.matchReviewedAction = "accept";
    } else if (input.action === "replace") {
      if (!input.bankTransactionId) {
        throw new Error("Replacement requires a selected transaction.");
      }
      await validateTransactionOwnership(input.bankTransactionId);
      await ensureNotAlreadyLinked(input.bankTransactionId);
      nextBankTransactionId = input.bankTransactionId;
      metadata.matchReviewStatus = "replaced";
      metadata.matchReviewedAction = "replace";
      metadata.replacedBankTransactionId = input.bankTransactionId;
    } else {
      nextBankTransactionId = null;
      metadata.matchReviewStatus = "rejected";
      metadata.matchReviewedAction = "reject";
    }

    metadata.matchReviewedAt = new Date().toISOString();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE trip_fundings
        SET
          bank_transaction_id = ${nextBankTransactionId},
          metadata = ${metadata as Prisma.InputJsonValue}
        WHERE id = ${fundingId} AND trip_id = ${tripId}
      `;

      await TripRepository.upsertFundingEntryTx(tx, userId, tripId, fundingId);
    });

    const updated = await TripRepository.getFundingsByTrip(userId, tripId);
    const match = updated.find((item) => item.id === fundingId);
    if (!match) {
      throw new Error("Failed to update funding match");
    }
    return match;
  }

  static async mergeImportedFundingIntoExisting(
    userId: string,
    tripId: string,
    importedFundingId: string,
    targetFundingId: string,
  ) {
    if (importedFundingId === targetFundingId) {
      throw new Error("Cannot merge a funding row into itself.");
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        sourceType: string;
        metadata: unknown;
        bankTransactionId: string | null;
      }>
    >`
      SELECT
        tf.id,
        tf.source_type AS "sourceType",
        tf.metadata,
        tf.bank_transaction_id AS "bankTransactionId"
      FROM trip_fundings tf
      INNER JOIN trips t ON t.id = tf.trip_id
      WHERE
        tf.trip_id = ${tripId}
        AND tf.id IN (${importedFundingId}, ${targetFundingId})
        AND t.user_id = ${userId}
    `;

    const source = rows.find((row) => row.id === importedFundingId);
    const target = rows.find((row) => row.id === targetFundingId);

    if (!source || !target) {
      throw new Error("Funding rows not found or unauthorized");
    }

    if (source.sourceType !== "imported_topup") {
      throw new Error("Only imported topup fundings can be merged.");
    }
    if (target.sourceType === "imported_topup") {
      throw new Error("Target funding must be an existing confirmed/manual funding row.");
    }

    const sourceMeta =
      source.metadata && typeof source.metadata === "object"
        ? (source.metadata as Record<string, unknown>)
        : {};
    const targetMeta =
      target.metadata && typeof target.metadata === "object"
        ? { ...(target.metadata as Record<string, unknown>) }
        : {};

    const mergedFrom = Array.isArray(targetMeta.mergedFromFundingIds)
      ? [...targetMeta.mergedFromFundingIds]
      : [];
    mergedFrom.push(importedFundingId);

    targetMeta.mergedFromFundingIds = mergedFrom;
    targetMeta.lastMergedAt = new Date().toISOString();
    targetMeta.lastMergedImportedFunding = {
      id: importedFundingId,
      ...(sourceMeta || {}),
    };

    if (
      !target.bankTransactionId &&
      typeof sourceMeta.autoMatchedBankTransactionId === "string" &&
      sourceMeta.autoMatchedBankTransactionId.length > 0
    ) {
      targetMeta.suggestedBankTransactionIdFromMergedImport =
        sourceMeta.autoMatchedBankTransactionId;
    }

    const sourceFeeEntryId =
      typeof sourceMeta.feeEntryId === "string"
        ? (sourceMeta.feeEntryId as string)
        : null;
    delete targetMeta.feeEntryId;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE trip_fundings
        SET metadata = ${targetMeta as Prisma.InputJsonValue}
        WHERE id = ${targetFundingId} AND trip_id = ${tripId}
      `;

      await TripRepository.upsertFundingEntryTx(tx, userId, tripId, targetFundingId);

      if (sourceFeeEntryId) {
        await tx.$executeRaw`
          DELETE FROM trip_entries
          WHERE id = ${sourceFeeEntryId} AND trip_id = ${tripId}
        `;
      }

      await TripRepository.deleteFundingEntryTx(tx, tripId, importedFundingId);

      await tx.$executeRaw`
        DELETE FROM trip_fundings
        WHERE id = ${importedFundingId} AND trip_id = ${tripId}
      `;
    });

    const updated = await TripRepository.getFundingsByTrip(userId, tripId);
    const match = updated.find((item) => item.id === targetFundingId);
    if (!match) {
      throw new Error("Failed to merge funding rows");
    }
    return match;
  }

  static async updateFunding(
    userId: string,
    tripId: string,
    fundingId: string,
    input: {
      walletId?: string | null;
      sourceCurrency?: string;
      sourceAmount?: number;
      destinationCurrency?: string;
      destinationAmount?: number;
      fxRate?: number | null;
      feeAmount?: number | null;
      feeCurrency?: string | null;
      metadata?: Record<string, any> | null;
    },
  ) {
    const existing = await prisma.$queryRaw<
      Array<{
        id: string;
        walletId: string | null;
        bankTransactionId: string | null;
        sourceType: string;
        sourceAmount: number;
        sourceCurrency: string;
        destinationAmount: number;
        destinationCurrency: string;
        fxRate: number | null;
        feeAmount: number | null;
        feeCurrency: string | null;
        metadata: unknown;
        bankTransactionDate: Date | null;
        baseCurrency: string;
      }>
    >`
      SELECT tf.id
      , tf.wallet_id AS "walletId"
      , tf.bank_transaction_id AS "bankTransactionId"
      , tf.source_type AS "sourceType"
      , tf.source_amount AS "sourceAmount"
      , tf.source_currency AS "sourceCurrency"
      , tf.destination_amount AS "destinationAmount"
      , tf.destination_currency AS "destinationCurrency"
      , tf.fx_rate AS "fxRate"
      , tf.fee_amount AS "feeAmount"
      , tf.fee_currency AS "feeCurrency"
      , tf.metadata
      , bt.date AS "bankTransactionDate"
      , t.base_currency AS "baseCurrency"
      FROM trip_fundings tf
      INNER JOIN trips t ON t.id = tf.trip_id
      LEFT JOIN transactions bt ON bt.id = tf.bank_transaction_id
      WHERE tf.id = ${fundingId} AND tf.trip_id = ${tripId} AND t.user_id = ${userId}
      LIMIT 1
    `;
    if (!existing[0]) {
      throw new Error("Funding not found or unauthorized");
    }

    const current = existing[0];
    const walletId =
      input.walletId === undefined ? current.walletId ?? null : input.walletId ?? null;
    let targetWalletCurrency: string | null = null;
    if (walletId) {
      const walletRows = await prisma.$queryRaw<
        Array<{ id: string; currency: string }>
      >`
        SELECT w.id, w.currency
        FROM wallets w
        INNER JOIN trips t ON t.id = w.trip_id
        WHERE w.id = ${walletId} AND w.trip_id = ${tripId} AND t.user_id = ${userId}
        LIMIT 1
      `;
      if (!walletRows[0]) {
        throw new Error("Wallet not found or unauthorized");
      }
      targetWalletCurrency = String(walletRows[0].currency || "").toUpperCase();
    }

    if (current.bankTransactionId) {
      const requestedSourceCurrency =
        input.sourceCurrency === undefined
          ? current.sourceCurrency
          : String(input.sourceCurrency || "").toUpperCase();
      if (
        requestedSourceCurrency &&
        requestedSourceCurrency !== String(current.sourceCurrency || "").toUpperCase()
      ) {
        throw new Error(
          "Source currency cannot be changed for bank-linked funding.",
        );
      }

      if (
        input.sourceAmount !== undefined &&
        Math.abs(Number(input.sourceAmount) - Number(current.sourceAmount || 0)) > 0.0001
      ) {
        throw new Error(
          "Source amount cannot be changed for bank-linked funding.",
        );
      }

      if (!walletId) {
        throw new Error(
          "Bank-linked funding must stay assigned to a destination wallet.",
        );
      }

      if (
        targetWalletCurrency &&
        input.destinationCurrency &&
        String(input.destinationCurrency || "").toUpperCase() !== targetWalletCurrency
      ) {
        throw new Error(
          "Destination currency must match the destination wallet currency for bank-linked funding.",
        );
      }
    }

    const destinationCurrencyForNormalization =
      current.bankTransactionId && targetWalletCurrency
        ? targetWalletCurrency
        : input.destinationCurrency ?? current.destinationCurrency;

    const normalized = TripRepository.normalizeFundingValues({
      sourceCurrency: input.sourceCurrency ?? current.sourceCurrency,
      sourceAmount: Number(input.sourceAmount ?? current.sourceAmount),
      destinationCurrency: destinationCurrencyForNormalization,
      destinationAmount:
        input.destinationAmount === undefined
          ? Number(current.destinationAmount)
          : Number(input.destinationAmount),
      fxRate:
        input.fxRate === undefined ? (current.fxRate ?? null) : (input.fxRate ?? null),
      feeAmount:
        input.feeAmount === undefined ? (current.feeAmount ?? null) : input.feeAmount,
      feeCurrency:
        input.feeCurrency === undefined ? (current.feeCurrency ?? null) : input.feeCurrency,
      baseCurrency: current.baseCurrency,
    });

    const existingMetadata: Record<string, unknown> =
      current.metadata && typeof current.metadata === "object"
        ? { ...(current.metadata as Record<string, unknown>) }
        : {};
    const nextMetadata: Record<string, unknown> =
      input.metadata === undefined
        ? { ...existingMetadata }
        : input.metadata && typeof input.metadata === "object"
          ? { ...(input.metadata as Record<string, unknown>) }
          : {};
    const previousFeeEntryId =
      typeof existingMetadata.feeEntryId === "string"
        ? (existingMetadata.feeEntryId as string)
        : null;
    delete nextMetadata.feeEntryId;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE trip_fundings tf
        SET
          wallet_id = ${walletId},
          source_currency = ${normalized.sourceCurrency},
          source_amount = ${normalized.sourceAmount},
          destination_currency = ${normalized.destinationCurrency},
          destination_amount = ${normalized.destinationAmount},
          fx_rate = ${normalized.fxRate},
          base_amount = ${normalized.baseAmount},
          fee_amount = ${normalized.feeAmount},
          fee_currency = ${normalized.feeCurrency},
          metadata = ${nextMetadata as Prisma.InputJsonValue}
        FROM trips t
        WHERE
          tf.id = ${fundingId}
          AND tf.trip_id = ${tripId}
          AND t.id = tf.trip_id
          AND t.user_id = ${userId}
      `;

      await TripRepository.upsertFundingEntryTx(tx, userId, tripId, fundingId);

      if (previousFeeEntryId) {
        await tx.$executeRaw`
          DELETE FROM trip_entries
          WHERE id = ${previousFeeEntryId} AND trip_id = ${tripId}
        `;
      }
    });

    const recalcWalletIds = Array.from(
      new Set(
        [current.walletId, walletId].filter(
          (candidate): candidate is string => Boolean(candidate),
        ),
      ),
    );
    const recalcResults = await Promise.all(
      recalcWalletIds.map((targetWalletId) =>
        TripRepository.recalculateWalletEntriesToBase(userId, tripId, targetWalletId, {
          mode: "weighted",
        }).catch(() => null),
      ),
    );
    const propagationTraces = recalcResults
      .map((result) => result?.propagationTrace)
      .filter((trace): trace is PropagationTrace => Boolean(trace));

    const updated = await TripRepository.getFundingsByTrip(userId, tripId);
    const match = updated.find((item) => item.id === fundingId);
    if (!match) {
      throw new Error("Failed to update funding");
    }
    return {
      funding: match,
      propagationTrace: propagationTraces.length > 0 ? propagationTraces : null,
    };
  }

  static async deleteFunding(userId: string, tripId: string, fundingId: string) {
    const existing = await prisma.$queryRaw<
      Array<{ metadata: unknown; walletId: string | null }>
    >`
      SELECT tf.metadata, tf.wallet_id AS "walletId"
      FROM trip_fundings tf
      INNER JOIN trips t ON t.id = tf.trip_id
      WHERE tf.id = ${fundingId} AND tf.trip_id = ${tripId} AND t.user_id = ${userId}
      LIMIT 1
    `;
    const metadata =
      existing[0]?.metadata && typeof existing[0].metadata === "object"
        ? (existing[0].metadata as Record<string, unknown>)
        : {};
    const feeEntryId =
      typeof metadata.feeEntryId === "string" ? metadata.feeEntryId : null;

    const rows = await prisma.$transaction(async (tx) => {
      if (feeEntryId) {
        await tx.$executeRaw`
          DELETE FROM trip_entries
          WHERE id = ${feeEntryId} AND trip_id = ${tripId}
        `;
      }

      await TripRepository.deleteFundingEntryTx(tx, tripId, fundingId);

      return tx.$queryRaw<Array<{ id: string }>>`
        DELETE FROM trip_fundings tf
        USING trips t
        WHERE tf.id = ${fundingId} AND tf.trip_id = ${tripId} AND t.id = tf.trip_id AND t.user_id = ${userId}
        RETURNING tf.id
      `;
    });
    if (!rows[0]) {
      throw new Error("Funding not found or unauthorized");
    }

    let propagationTrace: PropagationTrace | null = null;
    const walletId = existing[0]?.walletId || null;
    if (walletId) {
      const recalcResult = await TripRepository.recalculateWalletEntriesToBase(
        userId,
        tripId,
        walletId,
        {
          mode: "weighted",
        },
      ).catch(() => null);
      propagationTrace = recalcResult?.propagationTrace ?? null;
    }
    return { success: true, propagationTrace };
  }

  static async createWallet(
    userId: string,
    tripId: string,
    data: { name: string; currency: string; color?: string | null },
  ) {
    const tripRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!tripRows[0]) {
      throw new Error("Trip not found or unauthorized");
    }

    const resolvedColor = (data.color || "").trim()
      ? String(data.color).trim()
      : TripRepository.pickWalletColor(`${tripId}::${data.name}::${data.currency}`);

    const id = randomUUID();
    const [wallet] = await prisma.$queryRaw<any[]>`
      INSERT INTO wallets (
        id,
        trip_id,
        name,
        currency,
        color,
        created_at,
        updated_at
      )
      VALUES (
        ${id},
        ${tripId},
        ${data.name},
        ${data.currency},
        ${resolvedColor},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        trip_id AS "tripId",
        name,
        currency,
        color,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;
    return TripRepository.mapWallet(wallet);
  }

  static async findWallets(userId: string, tripId: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        w.id,
        w.trip_id AS "tripId",
        w.name,
        w.currency,
        w.color,
        w.created_at AS "createdAt",
        w.updated_at AS "updatedAt"
      FROM wallets w
      INNER JOIN trips t ON t.id = w.trip_id
      WHERE w.trip_id = ${tripId} AND t.user_id = ${userId}
      ORDER BY name ASC
    `;
    return rows.map(TripRepository.mapWallet);
  }

  static async recalculateWalletEntriesToBase(
    userId: string,
    tripId: string,
    walletId: string,
    input: {
      mode: "manual" | "weighted";
      fxRate?: number | null;
    },
    propagate: boolean = true,
  ) {
    const walletRows = await prisma.$queryRaw<
      Array<{
        id: string;
        currency: string;
        baseCurrency: string;
      }>
    >`
      SELECT
        w.id,
        w.currency,
        t.base_currency AS "baseCurrency"
      FROM wallets w
      INNER JOIN trips t ON t.id = w.trip_id
      WHERE w.id = ${walletId} AND w.trip_id = ${tripId} AND t.user_id = ${userId}
      LIMIT 1
    `;
    if (!walletRows[0]) {
      throw new Error("Wallet not found or unauthorized");
    }
    const wallet = walletRows[0];

    let fxRate: number;
    if (input.mode === "manual") {
      const manual = Number(input.fxRate || 0);
      if (!(manual > 0)) {
        throw new Error("Manual FX rate must be greater than 0.");
      }
      fxRate = manual;
    } else {
      if (wallet.currency.toUpperCase() === wallet.baseCurrency.toUpperCase()) {
        fxRate = 1;
      } else {
      const [weightedRow] = await prisma.$queryRaw<
        Array<{
          baseTotal: unknown;
          localTotal: unknown;
        }>
      >`
        SELECT
          COALESCE(
            SUM(
              COALESCE(
                tf.base_amount,
                CASE
                  WHEN UPPER(tf.source_currency) = UPPER(t.base_currency) THEN tf.source_amount
                  WHEN UPPER(tf.destination_currency) = UPPER(t.base_currency) THEN tf.destination_amount
                  ELSE tf.source_amount
                END
              )
            ),
            0
          ) AS "baseTotal",
          COALESCE(SUM(
            CASE
              WHEN UPPER(tf.destination_currency) = UPPER(w.currency) THEN tf.destination_amount
              ELSE 0::numeric
            END
          ), 0) AS "localTotal"
        FROM trip_fundings tf
        INNER JOIN trips t ON t.id = tf.trip_id
        INNER JOIN wallets w ON w.id = tf.wallet_id
        WHERE
          tf.trip_id = ${tripId}
          AND tf.wallet_id = ${walletId}
          AND (
            tf.source_type NOT IN ('imported_topup', 'opening_balance')
            OR COALESCE(tf.metadata->>'matchReviewStatus', '') IN ('accepted', 'replaced', 'confirmed')
          )
      `;

      const baseTotal = Number(weightedRow?.baseTotal ?? 0);
      const localTotal = Number(weightedRow?.localTotal ?? 0);
      if (!(baseTotal > 0) || !(localTotal > 0)) {
        throw new Error(
          "Unable to derive weighted FX from wallet fundings. Use manual FX rate.",
        );
      }
      fxRate = baseTotal / localTotal;
      }
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE trip_entries te
      SET
        fx_rate = ${fxRate},
        base_amount = ROUND((te.local_amount * ${fxRate})::numeric, 4)
      FROM trips t
      WHERE
        te.trip_id = ${tripId}
        AND te.wallet_id = ${walletId}
        AND t.id = te.trip_id
        AND t.user_id = ${userId}
        AND te.type IN ('spending', 'funding_out')
      RETURNING te.id
    `;

    let propagationTrace: PropagationTrace | null = null;
    if (propagate) {
      propagationTrace = await TripRepository.propagateFundingBaseAmountsAcrossTrips(
        userId,
        [{ tripId, walletId }],
      ).catch(() => null);
    }

    return {
      walletId: wallet.id,
      walletCurrency: wallet.currency,
      baseCurrency: wallet.baseCurrency,
      fxRate,
      updatedCount: rows.length,
      propagationTrace,
    };
  }

  static async importTripSpendings(
    userId: string,
    tripId: string,
    walletId: string | null | undefined,
    parserId: string | null | undefined,
    transactions: Array<{
      date: string;
      description: string;
      label?: string | null;
      categoryId?: string | null;
      entryType?: "spending" | "reimbursement" | "funding_out" | "funding_in";
      linkage?: {
        type: "reimbursement";
        reimbursesAllocations?: Array<{
          transactionId?: string;
          pendingBatchIndex?: number;
          amountBase: number;
        }>;
        reimbursementBaseAmount?: number;
        reimbursingFxRate?: number;
        leftoverCategoryId?: string | null;
      } | null;
      amountIn?: number | null;
      amountOut?: number | null;
      fundingOut?: {
        destinationType?: "bank" | "trip" | "external";
        destinationTripId?: string | null;
        bankTransactionId?: string | null;
        destinationCurrency?: string | null;
        destinationAmount?: number | null;
        fxRate?: number | null;
        feeAmount?: number | null;
        feeCurrency?: string | null;
      } | null;
      metadata?: Record<string, any> | null;
    }>,
  ) {
    const toNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const toCurrency = (value: unknown, fallback: string): string => {
      const raw = String(value ?? fallback).trim().toUpperCase();
      return raw || fallback.toUpperCase();
    };

    const tripRows = await prisma.$queryRaw<
      Array<{ id: string; baseCurrency: string }>
    >`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (!tripRows[0]) {
      throw new Error("Trip not found or unauthorized");
    }

    let selectedWalletCurrency: string | null = null;
    if (walletId) {
      const walletRows = await prisma.$queryRaw<Array<{ id: string; currency: string }>>`
        SELECT w.id, w.currency
        FROM wallets w
        INNER JOIN trips t ON t.id = w.trip_id
        WHERE w.id = ${walletId} AND w.trip_id = ${tripId} AND t.user_id = ${userId}
        LIMIT 1
      `;
      if (!walletRows[0]) {
        throw new Error("Wallet not found or unauthorized");
      }
      selectedWalletCurrency = String(walletRows[0].currency || "").toUpperCase();
    }

    const trip = tripRows[0];
    const baseCurrency = trip.baseCurrency.toUpperCase();
    const normalizedParserId = (parserId || "").toLowerCase();
    const forceStatementWalletRouting =
      normalizedParserId.includes("revolut") ||
      normalizedParserId.includes("youtrip");
    const parserProvider =
      normalizedParserId.includes("revolut")
        ? "Revolut"
        : normalizedParserId.includes("youtrip")
          ? "YouTrip"
          : "Trip";

    const walletKeyToId = new Map<string, string>();
    if (!walletId) {
      const existingWallets = await prisma.$queryRaw<
        Array<{ id: string; name: string; currency: string }>
      >`
        SELECT id, name, currency
        FROM wallets
        WHERE trip_id = ${tripId}
      `;
      existingWallets.forEach((row) => {
        walletKeyToId.set(`${row.name}::${row.currency.toUpperCase()}`, row.id);
      });
    }

    const resolveWalletName = (metadata: Record<string, any>, currency: string) => {
      const provider = String(metadata.provider || parserProvider || "Trip").trim();
      return `${provider || "Trip"} ${currency}`;
    };

    const resolveBaseAmount = (params: {
      localAmount: number;
      localCurrency: string;
      statementAmount: number;
      statementCurrency: string;
      metadata: Record<string, any>;
    }) => {
      const localCurrency = toCurrency(params.localCurrency, baseCurrency);
      const statementCurrency = toCurrency(params.statementCurrency, baseCurrency);
      const manualBaseAmount = toNumber(params.metadata.manualBaseAmount);
      const manualFxRate = toNumber(params.metadata.manualFxRate);

      if (manualBaseAmount && manualBaseAmount > 0) {
        return manualBaseAmount;
      }
      if (manualFxRate && manualFxRate > 0) {
        return params.localAmount * manualFxRate;
      }

      if (localCurrency === baseCurrency) return params.localAmount;
      if (statementCurrency === baseCurrency) return params.statementAmount;

      const fxRate = toNumber(params.metadata.fxRate);
      const fxBaseCurrency = toCurrency(
        params.metadata.fxBaseCurrency || params.metadata.baseCurrency,
        "",
      );
      const fxQuoteCurrency = toCurrency(
        params.metadata.fxQuoteCurrency || params.metadata.quoteCurrency,
        "",
      );

      if (fxRate && fxRate > 0) {
        if (fxBaseCurrency === baseCurrency && fxQuoteCurrency === localCurrency) {
          return params.localAmount / fxRate;
        }
        if (fxBaseCurrency === localCurrency && fxQuoteCurrency === baseCurrency) {
          return params.localAmount * fxRate;
        }
        if (fxBaseCurrency === baseCurrency && fxQuoteCurrency === statementCurrency) {
          return params.statementAmount / fxRate;
        }
        if (fxBaseCurrency === statementCurrency && fxQuoteCurrency === baseCurrency) {
          return params.statementAmount * fxRate;
        }
      }

      return params.statementAmount > 0 ? params.statementAmount : params.localAmount;
    };

    const providerKeyword = parserProvider.toLowerCase();
    const supportsOpeningBalanceSuggestion =
      normalizedParserId.includes("revolut") ||
      normalizedParserId.includes("youtrip");
    let importedSpendings = 0;
    let importedReimbursements = 0;
    let importedFundings = 0;
    let importedTransfers = 0;
    let importedFees = 0;
    let handledRows = 0;
    const usedBankTransactionIds = new Set<string>();
    const selectedIndexToImportedEntryId = new Map<number, string>();
    const pendingReimbursementLinks: Array<{
      sourceIndex: number;
      reimbursementEntryId: string;
      allocations: TripReimbursementAllocationInput[];
      leftoverCategoryId?: string | null;
    }> = [];

    await prisma.$transaction(async (tx) => {
      const openingBalanceSuggestions = new Map<
        string,
        {
          walletId: string;
          destinationCurrency: string;
          openingAmount: number;
          basisDate: Date;
          basisDescription: string;
          basisBalance: number;
          basisIn: number;
          basisOut: number;
        }
      >();

      const monthByAbbr: Record<string, number> = {
        JAN: 0,
        FEB: 1,
        MAR: 2,
        APR: 3,
        MAY: 4,
        JUN: 5,
        JUL: 6,
        AUG: 7,
        SEP: 8,
        OCT: 9,
        NOV: 10,
        DEC: 11,
      };

      const toDayKey = (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
      };

      const extractEffectiveBankDate = (description: string, postedDate: Date) => {
        // Typical card statements encode merchant date in description, e.g. "SGP 18DEC".
        const matches = Array.from(
          String(description || "").toUpperCase().matchAll(
            /(?:^|\D)(\d{1,2})\s*([A-Z]{3})(?=\D|$)/g,
          ),
        );
        if (!matches.length) return postedDate;

        for (const match of matches) {
          const day = Number(match[1]);
          const monthAbbr = match[2];
          const month = monthByAbbr[monthAbbr];
          if (!Number.isFinite(day) || day < 1 || day > 31 || month === undefined) {
            continue;
          }

          const posted = new Date(postedDate);
          const candidates = [posted.getFullYear() - 1, posted.getFullYear(), posted.getFullYear() + 1]
            .map((year) => new Date(year, month, day));
          const best = candidates.sort(
            (a, b) => Math.abs(a.getTime() - posted.getTime()) - Math.abs(b.getTime() - posted.getTime()),
          )[0];
          return best;
        }

        return postedDate;
      };

      const findFundingTransactionCandidates = async (params: {
        date: Date;
        expectedAmount: number;
      }) => {
        const startWindow = new Date(params.date);
        startWindow.setDate(startWindow.getDate() - 7);
        startWindow.setHours(0, 0, 0, 0);
        const endWindow = new Date(params.date);
        endWindow.setDate(endWindow.getDate() + 7);
        endWindow.setHours(23, 59, 59, 999);
        const targetDayKey = toDayKey(params.date);

        const expected = Number(params.expectedAmount || 0);
        if (!(expected > 0)) return null;
        const rawMatches = await tx.$queryRaw<
          Array<{
            id: string;
            date: Date;
            description: string;
            label: string | null;
            accountIdentifier: string | null;
            amountIn: unknown;
            amountOut: unknown;
          }>
        >`
          SELECT
            t.id,
            t.date,
            t.description,
            t.label,
            t.account_number AS "accountIdentifier",
            t.amount_in AS "amountIn",
            t.amount_out AS "amountOut"
          FROM transactions t
          WHERE
            t.user_id = ${userId}
            AND t.amount_out IS NOT NULL
            AND t.date BETWEEN ${startWindow} AND ${endWindow}
            AND ABS(t.amount_out - ${expected}) <= 0.01
            AND t.description ILIKE ${`%${providerKeyword}%`}
          ORDER BY
            t.date DESC,
            t.id DESC
          LIMIT 50
        `;

        const baseMatches = rawMatches.filter((match) => {
          const effectiveDate = extractEffectiveBankDate(match.description, new Date(match.date));
          return toDayKey(effectiveDate) === targetDayKey;
        });

        if (baseMatches.length === 0) {
          return {
            inFundingList: [] as Array<Record<string, unknown>>,
            outsideFundingList: [] as Array<Record<string, unknown>>,
            recommended: null as null | Record<string, unknown>,
          };
        }

        const ids = baseMatches.map((match) => match.id);
        const fundingRows = await tx.$queryRaw<
          Array<{
            fundingId: string;
            transactionId: string;
            sourceType: string;
            reviewStatus: string | null;
            walletId: string | null;
            walletName: string | null;
            walletCurrency: string | null;
          }>
        >`
          SELECT
            tf.id AS "fundingId",
            tf.bank_transaction_id AS "transactionId",
            tf.source_type AS "sourceType",
            tf.metadata->>'matchReviewStatus' AS "reviewStatus",
            tf.wallet_id AS "walletId",
            w.name AS "walletName",
            w.currency AS "walletCurrency"
          FROM trip_fundings tf
          LEFT JOIN wallets w ON w.id = tf.wallet_id
          WHERE tf.trip_id = ${tripId}
            AND tf.bank_transaction_id IN (${Prisma.join(ids)})
        `;

        const eligibleFundingRows = fundingRows.filter(
          (row) =>
            row.sourceType !== "imported_topup" ||
            ["accepted", "replaced", "confirmed"].includes(row.reviewStatus || ""),
        );
        const fundingByTx = new Map<string, (typeof eligibleFundingRows)[number]>();
        eligibleFundingRows.forEach((row) => {
          if (!fundingByTx.has(row.transactionId)) {
            fundingByTx.set(row.transactionId, row);
          }
        });

        const decorate = (match: (typeof baseMatches)[number]) => ({
          id: match.id,
          date: match.date,
          description: match.description,
          label: match.label,
          amountIn: match.amountIn !== null ? Number(match.amountIn) : null,
          amountOut: match.amountOut !== null ? Number(match.amountOut) : null,
          accountIdentifier: match.accountIdentifier,
        });

        const inFundingList = baseMatches
          .filter((match) => fundingByTx.has(match.id))
          .map((match) => {
            const linkedFunding = fundingByTx.get(match.id)!;
            return {
              ...decorate(match),
              source: "funding_list",
              fundingId: linkedFunding.fundingId,
              walletId: linkedFunding.walletId,
              walletName: linkedFunding.walletName,
              walletCurrency: linkedFunding.walletCurrency,
            };
          });

        const outsideFundingList = baseMatches
          .filter((match) => !fundingByTx.has(match.id))
          .map((match) => ({
            ...decorate(match),
            source: "bank",
          }));

        const recommendationPool = [...inFundingList, ...outsideFundingList];
        const recommended =
          recommendationPool.find(
            (item) =>
              typeof item.id === "string" && !usedBankTransactionIds.has(item.id),
          ) || recommendationPool[0] || null;
        if (recommended && typeof recommended.id === "string") {
          usedBankTransactionIds.add(recommended.id);
        }

        return { inFundingList, outsideFundingList, recommended };
      };

      const resolveWalletId = async (
        metadata: Record<string, any>,
        currency: string,
        forceAutoWallet: boolean = false,
      ) => {
        const normalizedCurrency = toCurrency(currency, baseCurrency);

        if (walletId && !forceAutoWallet && !forceStatementWalletRouting) {
          if (
            selectedWalletCurrency &&
            normalizedCurrency !== selectedWalletCurrency
          ) {
            throw new Error(
              `Selected wallet currency ${selectedWalletCurrency} does not match imported row currency ${normalizedCurrency}.`,
            );
          }
          return walletId;
        }

        const walletName = resolveWalletName(metadata, normalizedCurrency);
        const walletKey = `${walletName}::${normalizedCurrency}`;
        const cachedWalletId = walletKeyToId.get(walletKey);
        if (cachedWalletId) return cachedWalletId;

        const [existingWallet] = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM wallets
          WHERE trip_id = ${tripId}
            AND name = ${walletName}
            AND currency = ${normalizedCurrency}
          LIMIT 1
        `;

        if (existingWallet) {
          walletKeyToId.set(walletKey, existingWallet.id);
          return existingWallet.id;
        }

        const [createdWallet] = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO wallets (
            id,
            trip_id,
            name,
            currency,
            color,
            created_at,
            updated_at
          )
          VALUES (
            ${randomUUID()},
            ${tripId},
            ${walletName},
            ${normalizedCurrency},
            ${TripRepository.pickWalletColor(`${tripId}::${walletName}::${normalizedCurrency}`)},
            NOW(),
            NOW()
          )
          RETURNING id
        `;
        walletKeyToId.set(walletKey, createdWallet.id);
        return createdWallet.id;
      };

      const resolveWalletBaseFx = async (
        targetWalletId: string,
        targetWalletCurrency: string,
      ) => {
        const normalizedCurrency = toCurrency(targetWalletCurrency, baseCurrency);
        if (normalizedCurrency === baseCurrency) return 1;

        const [row] = await tx.$queryRaw<
          Array<{
            baseTotal: unknown;
            localTotal: unknown;
          }>
        >`
          SELECT
            COALESCE(
              SUM(
                COALESCE(
                  tf.base_amount,
                  CASE
                    WHEN UPPER(tf.source_currency) = UPPER(t.base_currency) THEN tf.source_amount
                    WHEN UPPER(tf.destination_currency) = UPPER(t.base_currency) THEN tf.destination_amount
                    ELSE tf.source_amount
                  END
                )
              ),
              0
            ) AS "baseTotal",
            COALESCE(
              SUM(
                CASE
                  WHEN UPPER(tf.destination_currency) = UPPER(w.currency) THEN tf.destination_amount
                  ELSE 0::numeric
                END
              ),
              0
            ) AS "localTotal"
          FROM trip_fundings tf
          INNER JOIN wallets w ON w.id = tf.wallet_id
          INNER JOIN trips t ON t.id = tf.trip_id
          WHERE
            tf.trip_id = ${tripId}
            AND tf.wallet_id = ${targetWalletId}
            AND (
              tf.source_type NOT IN ('imported_topup', 'opening_balance')
              OR COALESCE(tf.metadata->>'matchReviewStatus', '') IN ('accepted', 'replaced', 'confirmed')
            )
        `;

        const baseTotal = Number(row?.baseTotal || 0);
        const localTotal = Number(row?.localTotal || 0);
        if (!(baseTotal > 0) || !(localTotal > 0)) return null;
        return baseTotal / localTotal;
      };

      for (let transactionIndex = 0; transactionIndex < transactions.length; transactionIndex += 1) {
        const transaction = transactions[transactionIndex];
        const out = toNumber(transaction.amountOut) || 0;
        const incoming = toNumber(transaction.amountIn) || 0;
        const metadata =
          transaction.metadata && typeof transaction.metadata === "object"
            ? (transaction.metadata as Record<string, any>)
            : {};
        const explicitEntryType = String(
          transaction.entryType || metadata.entryType || "",
        )
          .trim()
          .toLowerCase();
        const transactionType = String(metadata.transactionType || "")
          .trim()
          .toLowerCase();
        const fundingInDisabled = metadata.fundingInDisabled === true;
        const isExplicitFundingIn = explicitEntryType === "funding_in";
        const isAutoFundingIn =
          transactionType === "topup" && !fundingInDisabled;
        const shouldTreatAsFundingIn = isExplicitFundingIn || isAutoFundingIn;
        const fundingOutInput =
          transaction.fundingOut && typeof transaction.fundingOut === "object"
            ? (transaction.fundingOut as Record<string, unknown>)
            : metadata.fundingOut && typeof metadata.fundingOut === "object"
              ? (metadata.fundingOut as Record<string, unknown>)
              : null;
        const statementCurrency = toCurrency(metadata.currency, baseCurrency);
        const conversionReviewInput =
          metadata.conversionReview &&
          typeof metadata.conversionReview === "object"
            ? (metadata.conversionReview as Record<string, unknown>)
            : null;
        const conversionReviewMode = String(
          conversionReviewInput?.mode || "",
        ).toLowerCase();

        const linkageInput =
          transaction.linkage && typeof transaction.linkage === "object"
            ? (transaction.linkage as Record<string, unknown>)
            : metadata.linkage && typeof metadata.linkage === "object"
              ? (metadata.linkage as Record<string, unknown>)
              : null;
        const reimbursementAllocationsInput =
          linkageInput?.type === "reimbursement" &&
          Array.isArray(linkageInput.reimbursesAllocations)
            ? (linkageInput.reimbursesAllocations as Array<Record<string, unknown>>)
            : [];
        const normalizedLinkAllocations =
          reimbursementAllocationsInput.length > 0
            ? TripRepository.normalizeTripReimbursementAllocations(
                reimbursementAllocationsInput.map((item) => ({
                  transactionId: item.transactionId
                    ? String(item.transactionId)
                    : undefined,
                  pendingBatchIndex:
                    typeof item.pendingBatchIndex === "number"
                      ? Number(item.pendingBatchIndex)
                      : undefined,
                  amountBase: Number(item.amountBase || 0),
                })),
              )
            : [];
        const linkageLeftoverCategoryId =
          linkageInput?.leftoverCategoryId === null ||
          linkageInput?.leftoverCategoryId === undefined
            ? null
            : String(linkageInput.leftoverCategoryId);
        const linkageReimbursementBaseAmount = toNumber(
          linkageInput?.reimbursementBaseAmount,
        );
        const linkageReimbursingFxRate = toNumber(linkageInput?.reimbursingFxRate);

        if (explicitEntryType === "reimbursement") {
          if (shouldTreatAsFundingIn) {
            throw new Error(
              "Funding In transactions cannot be marked as reimbursement.",
            );
          }
          if (!(incoming > 0)) {
            throw new Error(
              "Only positive inflow transactions can be marked as reimbursement",
            );
          }
          const localCurrency = toCurrency(statementCurrency, statementCurrency);
          const resolvedWalletId = await resolveWalletId(metadata, localCurrency);
          const localAmount = Number(incoming);
          const derivedBaseAmount = resolveBaseAmount({
            localAmount,
            localCurrency,
            statementAmount: incoming,
            statementCurrency,
            metadata,
          });
          const baseAmount =
            linkageReimbursementBaseAmount && linkageReimbursementBaseAmount > 0
              ? linkageReimbursementBaseAmount
              : linkageReimbursingFxRate && linkageReimbursingFxRate > 0
                ? localAmount * linkageReimbursingFxRate
                : derivedBaseAmount;
          const fxRate =
            linkageReimbursingFxRate && linkageReimbursingFxRate > 0
              ? linkageReimbursingFxRate
              : localAmount > 0
                ? baseAmount / localAmount
                : 1;
          const entryId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO trip_entries (
              id,
              trip_id,
              wallet_id,
              source_type,
              source_transaction_id,
              type,
              transaction_date,
              description,
              label,
              local_currency,
              local_amount,
              fx_rate,
              base_amount,
              fee_amount,
              fee_currency,
              category_id,
              linked_entry_id,
              metadata,
              created_at
            )
            VALUES (
              ${entryId},
              ${tripId},
              ${resolvedWalletId},
              'wallet',
              NULL,
              'reimbursement',
              ${new Date(transaction.date)},
              ${transaction.description},
              ${transaction.label ?? null},
              ${localCurrency},
              ${localAmount},
              ${fxRate},
              ${baseAmount},
              NULL,
              NULL,
              NULL,
              NULL,
              ${{
                ...metadata,
                importedFromTripParser: true,
                reimbursementValuationSource:
                  linkageReimbursementBaseAmount && linkageReimbursementBaseAmount > 0
                    ? "manual_base_amount"
                    : linkageReimbursingFxRate && linkageReimbursingFxRate > 0
                      ? "manual_fx_rate"
                      : "parser_or_wallet",
                reimbursementBaseAmount:
                  linkageReimbursementBaseAmount && linkageReimbursementBaseAmount > 0
                    ? linkageReimbursementBaseAmount
                    : baseAmount,
                reimbursementFxRate:
                  linkageReimbursingFxRate && linkageReimbursingFxRate > 0
                    ? linkageReimbursingFxRate
                    : fxRate,
                originalDescription: transaction.description,
                originalDate: transaction.date,
              } as Prisma.InputJsonValue},
              NOW()
            )
          `;
          selectedIndexToImportedEntryId.set(transactionIndex, entryId);
          if (normalizedLinkAllocations.length > 0) {
            pendingReimbursementLinks.push({
              sourceIndex: transactionIndex,
              reimbursementEntryId: entryId,
              allocations: normalizedLinkAllocations,
              leftoverCategoryId: linkageLeftoverCategoryId,
            });
          }
          importedReimbursements += 1;
          handledRows += 1;
          continue;
        }

        if (explicitEntryType === "funding_out") {
          if (shouldTreatAsFundingIn) {
            throw new Error(
              "Funding In transactions cannot be marked as Funding Out.",
            );
          }
          if (!(out > 0)) {
            throw new Error(
              "Only negative outflow transactions can be marked as Funding Out.",
            );
          }
          const localCurrency = toCurrency(statementCurrency, statementCurrency);
          const resolvedWalletId = await resolveWalletId(metadata, localCurrency);
          const localAmount = Number(toNumber(metadata.foreignAmount) || out);
          if (!(localAmount > 0)) continue;

          const baseAmount = resolveBaseAmount({
            localAmount,
            localCurrency,
            statementAmount: Math.max(out, incoming, localAmount),
            statementCurrency,
            metadata,
          });
          const fxRate = localAmount > 0 ? baseAmount / localAmount : 1;
          const normalizedFundingOut = await TripRepository.normalizeFundingOutConfig(
            tx,
            userId,
            {
              tripBaseCurrency: trip.baseCurrency,
              sourceCurrency: localCurrency,
              sourceAmount: localAmount,
              sourceBaseAmount: baseAmount,
              fundingOut: {
                destinationType:
                  (String(fundingOutInput?.destinationType || "external").toLowerCase() as
                    | "bank"
                    | "trip"
                    | "external"),
                destinationTripId: fundingOutInput?.destinationTripId
                  ? String(fundingOutInput.destinationTripId)
                  : null,
                bankTransactionId: fundingOutInput?.bankTransactionId
                  ? String(fundingOutInput.bankTransactionId)
                  : null,
                destinationCurrency: toCurrency(
                  fundingOutInput?.destinationCurrency,
                  localCurrency,
                ),
                destinationAmount: toNumber(fundingOutInput?.destinationAmount),
                fxRate: toNumber(fundingOutInput?.fxRate),
                feeAmount:
                  toNumber(fundingOutInput?.feeAmount) || toNumber(metadata.feeAmount),
                feeCurrency: toCurrency(
                  fundingOutInput?.feeCurrency || metadata.feeCurrency,
                  localCurrency,
                ),
              },
            },
          );
          const feeAmount = normalizedFundingOut.feeAmount;
          const feeCurrency = normalizedFundingOut.feeCurrency;

          await tx.$executeRaw`
            INSERT INTO trip_entries (
              id,
              trip_id,
              wallet_id,
              source_type,
              source_transaction_id,
              type,
              transaction_date,
              description,
              label,
              local_currency,
              local_amount,
              fx_rate,
              base_amount,
              fee_amount,
              fee_currency,
              category_id,
              linked_entry_id,
              metadata,
              created_at
            )
            VALUES (
              ${randomUUID()},
              ${tripId},
              ${resolvedWalletId},
              'wallet_funding_out',
              NULL,
              'funding_out',
              ${new Date(transaction.date)},
              ${transaction.description},
              ${transaction.label ?? null},
              ${localCurrency},
              ${localAmount},
              ${fxRate},
              ${baseAmount},
              NULL,
              NULL,
              NULL,
              NULL,
              ${{
                ...metadata,
                importedFromTripParser: true,
                entryType: "funding_out",
                fundingOut: {
                  destinationType: normalizedFundingOut.destinationType,
                  destinationTripId: normalizedFundingOut.destinationTripId,
                  bankTransactionId: normalizedFundingOut.bankTransactionId,
                  destinationCurrency: normalizedFundingOut.destinationCurrency,
                  destinationAmount: normalizedFundingOut.destinationAmount,
                  fxRate: normalizedFundingOut.fxRate,
                  feeAmount: feeAmount ?? null,
                  feeCurrency: feeCurrency ?? null,
                },
                originalDescription: transaction.description,
                originalDate: transaction.date,
              } as Prisma.InputJsonValue},
              NOW()
            )
          `;

          handledRows += 1;
          continue;
        }

        if (!isExplicitFundingIn && transactionType === "conversion") {
          if (conversionReviewMode === "skip_duplicate") {
            handledRows += 1;
            continue;
          }

          if (conversionReviewMode === "link_existing") {
            const linkedFundingId = conversionReviewInput?.linkedFundingId
              ? String(conversionReviewInput.linkedFundingId)
              : null;
            if (!linkedFundingId) {
              throw new Error(
                "Conversion match is missing linked funding reference.",
              );
            }

            const [existingFunding] = await tx.$queryRaw<
              Array<{
                id: string;
                metadata: Record<string, unknown> | null;
              }>
            >`
              SELECT tf.id, tf.metadata
              FROM trip_fundings tf
              INNER JOIN trips t ON t.id = tf.trip_id
              WHERE
                tf.id = ${linkedFundingId}
                AND tf.trip_id = ${tripId}
                AND tf.source_type = 'wallet_conversion'
                AND t.user_id = ${userId}
              LIMIT 1
            `;

            if (!existingFunding) {
              throw new Error(
                "Selected conversion match could not be found for this trip.",
              );
            }

            const existingMetadata =
              existingFunding.metadata &&
              typeof existingFunding.metadata === "object"
                ? {
                    ...(existingFunding.metadata as Record<string, unknown>),
                  }
                : {};
            const existingMirrorMatches = Array.isArray(
              existingMetadata.mirrorMatches,
            )
              ? (existingMetadata.mirrorMatches as Array<Record<string, unknown>>)
              : [];
            const mirrorMatches = [
              ...existingMirrorMatches,
              {
                linkedAt: new Date().toISOString(),
                parserId,
                date: transaction.date,
                description: transaction.description,
                statementCurrency,
                statementAmount:
                  incoming > 0 ? incoming : out > 0 ? out : null,
                fromAmount: toNumber(metadata.fromAmount),
                fromCurrency: metadata.fromCurrency
                  ? String(metadata.fromCurrency)
                  : null,
                toAmount: toNumber(metadata.toAmount),
                toCurrency: metadata.toCurrency
                  ? String(metadata.toCurrency)
                  : null,
              },
            ];

            await tx.$executeRaw`
              UPDATE trip_fundings
              SET metadata = ${{
                ...existingMetadata,
                mirrorMatches,
              } as Prisma.InputJsonValue}
              WHERE id = ${linkedFundingId}
            `;

            handledRows += 1;
            continue;
          }
        }

        if (supportsOpeningBalanceSuggestion) {
          const rowBalance = toNumber((transaction as { balance?: unknown }).balance);
          const rowMovement = Math.max(incoming, out);
          if (rowBalance !== null && rowMovement > 0) {
            const openingAmount = Number((rowBalance + out - incoming).toFixed(2));
            if (openingAmount > 0) {
              const openingWalletId = await resolveWalletId(
                metadata,
                statementCurrency,
                true,
              );
              const suggestionKey = `${openingWalletId}::${statementCurrency}`;
              const txDate = new Date(transaction.date);
              const existing = openingBalanceSuggestions.get(suggestionKey);
              if (!existing || txDate.getTime() < existing.basisDate.getTime()) {
                openingBalanceSuggestions.set(suggestionKey, {
                  walletId: openingWalletId,
                  destinationCurrency: statementCurrency,
                  openingAmount,
                  basisDate: txDate,
                  basisDescription: transaction.description || "Imported statement row",
                  basisBalance: rowBalance,
                  basisIn: incoming,
                  basisOut: out,
                });
              }
            }
          }
        }

        if (
          !isExplicitFundingIn &&
          transactionType === "conversion" &&
          toNumber(metadata.fromAmount) &&
          toNumber(metadata.toAmount) &&
          metadata.fromCurrency &&
          metadata.toCurrency
        ) {
          const fromAmount = Number(toNumber(metadata.fromAmount) || 0);
          const toAmount = Number(toNumber(metadata.toAmount) || 0);
          const fromCurrency = toCurrency(metadata.fromCurrency, baseCurrency);
          const toCurrencyCode = toCurrency(metadata.toCurrency, baseCurrency);

          if (fromAmount > 0 && toAmount > 0) {
            const fromWalletId = await resolveWalletId(
              metadata,
              fromCurrency,
              true,
            );
            const toWalletId = await resolveWalletId(metadata, toCurrencyCode, true);

            const sourceWalletBaseFx = await resolveWalletBaseFx(
              fromWalletId,
              fromCurrency,
            );

            const fallbackBaseAmount =
              fromCurrency === baseCurrency
                ? fromAmount
                : toCurrencyCode === baseCurrency
                  ? toAmount
                  : resolveBaseAmount({
                      localAmount: fromAmount,
                      localCurrency: fromCurrency,
                      statementAmount: Math.max(incoming, out, toAmount, fromAmount),
                      statementCurrency,
                      metadata,
                    });
            const baseAmountFrom =
              sourceWalletBaseFx && sourceWalletBaseFx > 0
                ? fromAmount * sourceWalletBaseFx
                : fallbackBaseAmount;

            const rawFeeAmount = Number(toNumber(metadata.feeAmount) || 0);
            const rawFeeCurrency = rawFeeAmount
              ? toCurrency(metadata.feeCurrency || toCurrencyCode, toCurrencyCode)
              : null;

            let normalizedConversion;
            try {
              normalizedConversion = TripRepository.normalizeFundingValues({
                sourceCurrency: fromCurrency,
                sourceAmount: fromAmount,
                destinationCurrency: toCurrencyCode,
                destinationAmount: toAmount,
                fxRate: null,
                feeAmount: rawFeeAmount > 0 ? rawFeeAmount : null,
                feeCurrency: rawFeeCurrency,
                baseCurrency,
              });
            } catch {
              normalizedConversion = TripRepository.normalizeFundingValues({
                sourceCurrency: fromCurrency,
                sourceAmount: fromAmount,
                destinationCurrency: toCurrencyCode,
                destinationAmount: toAmount,
                fxRate: null,
                feeAmount: null,
                feeCurrency: null,
                baseCurrency,
              });
            }
            normalizedConversion = {
              ...normalizedConversion,
              baseAmount: baseAmountFrom,
            };

            const conversionOutId = randomUUID();
            const conversionFundingId = randomUUID();
            const conversionMetadata = {
              ...metadata,
              importedFromTripParser: true,
              transferType: "currency_conversion",
              originalDescription: transaction.description,
              originalDate: transaction.date,
              sourceTripEntryId: conversionOutId,
            } as Prisma.InputJsonValue;

            await tx.$executeRaw`
              INSERT INTO trip_entries (
                id,
                trip_id,
                wallet_id,
                source_type,
                source_transaction_id,
                type,
                transaction_date,
                description,
                label,
                local_currency,
                local_amount,
                fx_rate,
                base_amount,
                fee_amount,
                fee_currency,
                category_id,
                linked_entry_id,
                metadata,
                created_at
              )
              VALUES (
                ${conversionOutId},
                ${tripId},
                ${fromWalletId},
                'wallet_conversion_out',
                NULL,
                'funding_out',
                ${new Date(transaction.date)},
                ${transaction.description || "Wallet Conversion"},
                ${transaction.label ?? null},
                ${fromCurrency},
                ${normalizedConversion.sourceAmount},
                ${normalizedConversion.sourceAmount > 0
                  ? normalizedConversion.baseAmount / normalizedConversion.sourceAmount
                  : 1},
                ${normalizedConversion.baseAmount},
                NULL,
                NULL,
                NULL,
                NULL,
                ${{
                  ...metadata,
                  importedFromTripParser: true,
                  entryType: "funding_out",
                  fundingOut: {
                    destinationType: "wallet",
                    destinationTripId: tripId,
                    destinationWalletId: toWalletId,
                    destinationCurrency: normalizedConversion.destinationCurrency,
                    destinationAmount: normalizedConversion.destinationAmount,
                    fxRate: normalizedConversion.fxRate,
                    feeAmount: normalizedConversion.feeAmount,
                    feeCurrency: normalizedConversion.feeCurrency,
                  },
                  transferType: "currency_conversion",
                  sourceTripFundingId: conversionFundingId,
                  originalDescription: transaction.description,
                  originalDate: transaction.date,
                } as Prisma.InputJsonValue},
                NOW()
              )
            `;

            await tx.$executeRaw`
              INSERT INTO trip_fundings (
                id,
                trip_id,
                wallet_id,
                entry_id,
                bank_transaction_id,
                source_type,
                source_currency,
                source_amount,
                destination_currency,
                destination_amount,
                fx_rate,
                base_amount,
                fee_amount,
                fee_currency,
                metadata,
                created_at
              )
              VALUES (
                ${conversionFundingId},
                ${tripId},
                ${toWalletId},
                NULL,
                NULL,
                'wallet_conversion',
                ${normalizedConversion.sourceCurrency},
                ${normalizedConversion.sourceAmount},
                ${normalizedConversion.destinationCurrency},
                ${normalizedConversion.destinationAmount},
                ${normalizedConversion.fxRate},
                ${normalizedConversion.baseAmount},
                ${normalizedConversion.feeAmount},
                ${normalizedConversion.feeCurrency},
                ${{
                  ...metadata,
                  importedFromTripParser: true,
                  sourceTripEntryId: conversionOutId,
                  sourceWalletId: fromWalletId,
                  destinationWalletId: toWalletId,
                  transferType: "currency_conversion",
                  matchReviewStatus: "confirmed",
                  originalDescription: transaction.description,
                  originalDate: transaction.date,
                } as Prisma.InputJsonValue},
                NOW()
              )
            `;

            await TripRepository.upsertFundingEntryTx(
              tx,
              userId,
              tripId,
              conversionFundingId,
            );

            importedFundings += 1;
            importedTransfers += 1;
            handledRows += 1;
            continue;
          }
        }

        if (shouldTreatAsFundingIn) {
          if (!(incoming > 0)) {
            throw new Error(
              "Only positive inflow transactions can be marked as Funding In.",
            );
          }
          const sourceTag = String(metadata.source || "").toLowerCase();
          const isCsvBackedRow = sourceTag.includes("csv");
          const statementAmount =
            incoming > 0
              ? incoming
              : out > 0
                ? out
                : Number(toNumber(metadata.statementAmount) || 0);
          const feeFromAmounts =
            incoming > 0 && out > 0 ? Number(out) : Number(toNumber(metadata.feeAmount) || 0);
          const explicitDestinationAmount = Number(
            toNumber(metadata.foreignAmount) || toNumber(metadata.toAmount) || 0,
          );
          let destinationAmount =
            explicitDestinationAmount > 0
              ? explicitDestinationAmount
              : isCsvBackedRow && incoming > 0 && feeFromAmounts > 0
                ? Number((incoming - feeFromAmounts).toFixed(4))
                : statementAmount > 0
                  ? statementAmount
                  : 0;
          const destinationCurrency = toCurrency(
            metadata.toCurrency ||
              metadata.foreignCurrency ||
              statementCurrency,
            baseCurrency,
          );
          // Topups are statement-currency specific and should always target
          // the auto-detected wallet for that currency/provider, regardless of
          // a globally selected import wallet.
          const resolvedWalletId = await resolveWalletId(
            metadata,
            destinationCurrency,
            true,
          );

          if (destinationAmount > 0) {
            const fundingId = randomUUID();
            let feeAmount = feeFromAmounts > 0 ? feeFromAmounts : Number(toNumber(metadata.feeAmount) || 0);
            let feeCurrency = feeAmount
              ? toCurrency(
                  metadata.feeCurrency || destinationCurrency,
                  destinationCurrency,
                )
              : null;

            // Revolut/YouTrip sometimes represent topups as "charged amount" + "credited amount".
            // If explicit fee is missing, infer it from statement amount delta.
            if (!(feeAmount > 0) && statementAmount > 0) {
              const creditedAmount = Number(
                toNumber(metadata.foreignAmount) ||
                  toNumber(metadata.toAmount) ||
                  0,
              );
              const creditedCurrency = toCurrency(
                metadata.foreignCurrency ||
                  metadata.toCurrency ||
                  destinationCurrency,
                destinationCurrency,
              );

              if (
                creditedAmount > 0 &&
                creditedCurrency === destinationCurrency &&
                statementAmount - creditedAmount > 0.0001
              ) {
                feeAmount = Number((statementAmount - creditedAmount).toFixed(4));
                feeCurrency = destinationCurrency;
                destinationAmount = creditedAmount;
                metadata.feeInferred = true;
              }
            }
            const sourceCurrency = statementCurrency;
            const sourceAmount = isCsvBackedRow
              ? statementAmount > 0
                ? statementAmount
                : destinationAmount
              : destinationAmount +
                (feeAmount > 0 && feeCurrency === sourceCurrency ? feeAmount : 0);
            const normalizedFunding = TripRepository.normalizeFundingValues({
              sourceCurrency,
              sourceAmount,
              destinationCurrency,
              destinationAmount,
              fxRate: null,
              feeAmount,
              feeCurrency: feeAmount > 0 ? feeCurrency : null,
              baseCurrency,
            });
            const candidateMatches = await findFundingTransactionCandidates({
              date: new Date(transaction.date),
              expectedAmount: normalizedFunding.sourceAmount,
            });
            const resolvedCandidateMatches =
              candidateMatches || {
                inFundingList: [] as Array<Record<string, unknown>>,
                outsideFundingList: [] as Array<Record<string, unknown>>,
                recommended: null as null | Record<string, unknown>,
              };
            const recommendedMatch = resolvedCandidateMatches.recommended as
              | (Record<string, unknown> & { id?: string; source?: string; fundingId?: string })
              | null;

            await tx.$executeRaw`
              INSERT INTO trip_fundings (
                id,
                trip_id,
                wallet_id,
                entry_id,
                bank_transaction_id,
                source_type,
                source_currency,
                source_amount,
                destination_currency,
                destination_amount,
                fx_rate,
                base_amount,
                fee_amount,
                fee_currency,
                metadata,
                created_at
              )
              VALUES (
                ${fundingId},
                ${tripId},
                ${resolvedWalletId},
                NULL,
                ${null},
                'imported_topup',
                ${normalizedFunding.sourceCurrency},
                ${normalizedFunding.sourceAmount},
                ${normalizedFunding.destinationCurrency},
                ${normalizedFunding.destinationAmount},
                ${normalizedFunding.fxRate},
                ${normalizedFunding.baseAmount},
                ${normalizedFunding.feeAmount},
                ${normalizedFunding.feeCurrency},
                ${{
                  ...metadata,
                  importedFromTripParser: true,
                  autoMatchedBankTransactionId: recommendedMatch?.id || null,
                  autoMatchedCandidateSource: recommendedMatch?.source || null,
                  autoMatchedFundingId: recommendedMatch?.fundingId || null,
                  autoMatchCandidates: {
                    inFundingList: resolvedCandidateMatches.inFundingList,
                    outsideFundingList: resolvedCandidateMatches.outsideFundingList,
                    providerKeyword,
                  },
                  matchReviewStatus: recommendedMatch?.id ? "pending" : "unmatched",
                  originalDescription: transaction.description,
                  originalDate: transaction.date,
                } as Prisma.InputJsonValue},
                NOW()
              )
            `;

            await TripRepository.upsertFundingEntryTx(
              tx,
              userId,
              tripId,
              fundingId,
            );
            importedFundings += 1;

            handledRows += 1;
            continue;
          }
        }

        // Revolut/YouTrip statement rows are settled in statement currency.
        // Merchant currency (if present) is informational only for spending rows.
        const localCurrency = toCurrency(statementCurrency, statementCurrency);
        const resolvedWalletId = await resolveWalletId(metadata, localCurrency);

        if (out > 0) {
          const localAmount = Number(out);
          const baseAmount = resolveBaseAmount({
            localAmount,
            localCurrency,
            statementAmount: out,
            statementCurrency,
            metadata,
          });
          const fxRate = localAmount > 0 ? baseAmount / localAmount : 1;
          const entryId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO trip_entries (
              id,
              trip_id,
              wallet_id,
              source_type,
              source_transaction_id,
              type,
              transaction_date,
              description,
              label,
              local_currency,
              local_amount,
              fx_rate,
              base_amount,
              fee_amount,
              fee_currency,
              category_id,
              linked_entry_id,
              metadata,
              created_at
            )
            VALUES (
              ${entryId},
              ${tripId},
              ${resolvedWalletId},
              'wallet',
              NULL,
              'spending',
              ${new Date(transaction.date)},
              ${transaction.description},
              ${transaction.label ?? null},
              ${localCurrency},
              ${localAmount},
              ${fxRate},
              ${baseAmount},
              ${metadata.feeAmount ?? null},
              ${metadata.feeCurrency ?? null},
              ${transaction.categoryId ?? null},
              NULL,
              ${{
                ...metadata,
                importedFromTripParser: true,
                originalDescription: transaction.description,
                originalDate: transaction.date,
              } as Prisma.InputJsonValue},
              NOW()
            )
          `;
          selectedIndexToImportedEntryId.set(transactionIndex, entryId);
          importedSpendings += 1;
          handledRows += 1;
          continue;
        }

        if (incoming > 0) {
          const localAmount = Number(incoming);
          const baseAmount = resolveBaseAmount({
            localAmount,
            localCurrency,
            statementAmount: incoming,
            statementCurrency,
            metadata,
          });
          const fxRate = localAmount > 0 ? baseAmount / localAmount : 1;
          const entryId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO trip_entries (
              id,
              trip_id,
              wallet_id,
              source_type,
              source_transaction_id,
              type,
              transaction_date,
              description,
              label,
              local_currency,
              local_amount,
              fx_rate,
              base_amount,
              fee_amount,
              fee_currency,
              category_id,
              linked_entry_id,
              metadata,
              created_at
            )
            VALUES (
              ${entryId},
              ${tripId},
              ${resolvedWalletId},
              'wallet',
              NULL,
              'reimbursement',
              ${new Date(transaction.date)},
              ${transaction.description},
              ${transaction.label ?? null},
              ${localCurrency},
              ${localAmount},
              ${fxRate},
              ${baseAmount},
              NULL,
              NULL,
              NULL,
              NULL,
              ${{
                ...metadata,
                importedFromTripParser: true,
                originalDescription: transaction.description,
                originalDate: transaction.date,
              } as Prisma.InputJsonValue},
              NOW()
            )
          `;
          selectedIndexToImportedEntryId.set(transactionIndex, entryId);

          if (normalizedLinkAllocations.length > 0) {
            pendingReimbursementLinks.push({
              sourceIndex: transactionIndex,
              reimbursementEntryId: entryId,
              allocations: normalizedLinkAllocations,
              leftoverCategoryId: linkageLeftoverCategoryId,
            });
          }
          importedReimbursements += 1;
          handledRows += 1;
        }
      }

      if (pendingReimbursementLinks.length > 0) {
        for (const link of pendingReimbursementLinks) {
          const resolvedAllocations = link.allocations
            .map((allocation) => {
              if (allocation.transactionId) {
                return {
                  transactionId: allocation.transactionId,
                  amountBase: allocation.amountBase,
                };
              }
              if (typeof allocation.pendingBatchIndex !== "number") {
                return null;
              }
              const targetId = selectedIndexToImportedEntryId.get(
                allocation.pendingBatchIndex,
              );
              if (!targetId) return null;
              return {
                transactionId: targetId,
                amountBase: allocation.amountBase,
              };
            })
            .filter(
              (item): item is { transactionId: string; amountBase: number } =>
                !!item && item.amountBase > 0,
            );

          if (resolvedAllocations.length === 0) continue;
          await TripRepository.applyTripReimbursementAllocations(
            tx,
            tripId,
            link.reimbursementEntryId,
            resolvedAllocations,
            link.leftoverCategoryId ?? null,
          );
        }
      }

      if (supportsOpeningBalanceSuggestion && openingBalanceSuggestions.size > 0) {
        const existingRows = await tx.$queryRaw<
          Array<{
            walletId: string | null;
            destinationCurrency: string;
          }>
        >`
          SELECT
            tf.wallet_id AS "walletId",
            tf.destination_currency AS "destinationCurrency"
          FROM trip_fundings tf
          WHERE
            tf.trip_id = ${tripId}
            AND tf.source_type = 'opening_balance'
        `;
        const existingKeySet = new Set(
          existingRows
            .filter((row) => row.walletId)
            .map(
              (row) =>
                `${String(row.walletId)}::${toCurrency(row.destinationCurrency, baseCurrency)}`,
            ),
        );

        for (const suggestion of openingBalanceSuggestions.values()) {
          const suggestionKey = `${suggestion.walletId}::${suggestion.destinationCurrency}`;
          if (existingKeySet.has(suggestionKey)) {
            continue;
          }
          existingKeySet.add(suggestionKey);
          const openingFundingId = randomUUID();

          await tx.$executeRaw`
            INSERT INTO trip_fundings (
              id,
              trip_id,
              wallet_id,
              entry_id,
              bank_transaction_id,
              source_type,
              source_currency,
              source_amount,
              destination_currency,
              destination_amount,
              fx_rate,
              base_amount,
              fee_amount,
              fee_currency,
              metadata,
              created_at
            )
            VALUES (
              ${openingFundingId},
              ${tripId},
              ${suggestion.walletId},
              NULL,
              NULL,
              'opening_balance',
              ${suggestion.destinationCurrency},
              ${suggestion.openingAmount},
              ${suggestion.destinationCurrency},
              ${suggestion.openingAmount},
              1,
              ${suggestion.openingAmount},
              NULL,
              NULL,
              ${{
                importedFromTripParser: true,
                matchReviewStatus: "pending",
                matchReviewedAction: null,
                openingBalanceSuggestion: true,
                parserProvider,
                parserId: normalizedParserId || null,
                basisTransactionDate: suggestion.basisDate.toISOString(),
                basisTransactionDescription: suggestion.basisDescription,
                basisBalance: suggestion.basisBalance,
                basisAmountIn: suggestion.basisIn,
                basisAmountOut: suggestion.basisOut,
              } as Prisma.InputJsonValue},
              NOW()
            )
          `;
          await TripRepository.upsertFundingEntryTx(
            tx,
            userId,
            tripId,
            openingFundingId,
          );
          importedFundings += 1;
        }
      }
    });

    return {
      importedSpendings,
      importedReimbursements,
      importedFundings,
      importedTransfers,
      importedFees,
      skipped: Math.max(0, transactions.length - handledRows),
    };
  }

  static async getFundingCandidates(
    userId: string,
    tripId: string,
    search?: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    const query = search?.trim();
    const cappedLimit = Math.max(1, Math.min(limit, 300));
    const cappedOffset = Math.max(0, offset);
    const whereConditions: Prisma.Sql[] = [Prisma.sql`t.user_id = ${userId}`];

    if (query) {
      whereConditions.push(
        Prisma.sql`(t.description ILIKE ${`%${query}%`} OR COALESCE(t.label, '') ILIKE ${`%${query}%`})`,
      );
    }

    whereConditions.push(
      Prisma.sql`NOT EXISTS (
        SELECT 1
        FROM trip_fundings tf
        WHERE tf.bank_transaction_id = t.id AND tf.trip_id = ${tripId}
      )`,
    );

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          t.id,
          t.date,
          t.description,
          t.label,
          t.amount_in AS "amountIn",
          t.amount_out AS "amountOut",
          t.account_number AS "accountIdentifier",
          c.id AS "categoryId",
          c.name AS "categoryName",
          c.color AS "categoryColor"
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE ${Prisma.join(whereConditions, " AND ")}
        ORDER BY t.date DESC
        LIMIT ${cappedLimit}
        OFFSET ${cappedOffset}
      `,
      prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*)::bigint AS total
        FROM transactions t
        WHERE ${Prisma.join(whereConditions, " AND ")}
      `,
    ]);

    const transactions = rows.map((row) => ({
      id: row.id,
      date: row.date,
      description: row.description,
      label: row.label,
      amountIn: row.amountIn !== null ? Number(row.amountIn) : null,
      amountOut: row.amountOut !== null ? Number(row.amountOut) : null,
      category: row.categoryId
        ? {
            id: row.categoryId,
            name: row.categoryName,
            color: row.categoryColor,
          }
        : null,
      accountIdentifier: row.accountIdentifier,
    }));

    return {
      transactions,
      total: Number(countRows[0]?.total || 0),
    };
  }

  static async getSourceTransactionCandidates(
    userId: string,
    tripId: string,
    search?: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    const query = search?.trim();
    const cappedLimit = Math.max(1, Math.min(limit, 300));
    const cappedOffset = Math.max(0, offset);
    const whereConditions: Prisma.Sql[] = [Prisma.sql`t.user_id = ${userId}`];

    if (query) {
      whereConditions.push(
        Prisma.sql`(t.description ILIKE ${`%${query}%`} OR COALESCE(t.label, '') ILIKE ${`%${query}%`})`,
      );
    }

    whereConditions.push(
      Prisma.sql`NOT EXISTS (
        SELECT 1
        FROM trip_entries te
        WHERE te.trip_id = ${tripId} AND te.source_transaction_id = t.id
      )`,
    );

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          t.id,
          t.date,
          t.description,
          t.label,
          t.amount_in AS "amountIn",
          t.amount_out AS "amountOut",
          t.account_number AS "accountIdentifier",
          c.id AS "categoryId",
          c.name AS "categoryName",
          c.color AS "categoryColor"
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE ${Prisma.join(whereConditions, " AND ")}
        ORDER BY t.date DESC
        LIMIT ${cappedLimit}
        OFFSET ${cappedOffset}
      `,
      prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*)::bigint AS total
        FROM transactions t
        WHERE ${Prisma.join(whereConditions, " AND ")}
      `,
    ]);

    const transactions = rows.map((row) => ({
      id: row.id,
      date: row.date,
      description: row.description,
      label: row.label,
      amountIn: row.amountIn !== null ? Number(row.amountIn) : null,
      amountOut: row.amountOut !== null ? Number(row.amountOut) : null,
      category: row.categoryId
        ? {
            id: row.categoryId,
            name: row.categoryName,
            color: row.categoryColor,
          }
        : null,
      accountIdentifier: row.accountIdentifier,
    }));

    return {
      transactions,
      total: Number(countRows[0]?.total || 0),
    };
  }

  static async getOutgoingFundingEntryCandidates(
    userId: string,
    tripId: string,
    sourceTripId?: string,
    search?: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    const cappedLimit = Math.max(1, Math.min(limit, 300));
    const cappedOffset = Math.max(0, offset);
    const query = search?.trim();

    const [trip] = await prisma.$queryRaw<Array<{ id: string; baseCurrency: string }>>`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!trip) {
      throw new Error("Trip not found or unauthorized");
    }

    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`te.type = 'funding_out'`,
      Prisma.sql`t.user_id = ${userId}`,
      Prisma.sql`te.trip_id <> ${tripId}`,
      Prisma.sql`NOT EXISTS (
        SELECT 1
        FROM trip_fundings tf
        WHERE
          tf.trip_id = ${tripId}
          AND COALESCE(tf.metadata->>'sourceTripEntryId', '') = te.id
      )`,
    ];

    if (sourceTripId) {
      whereConditions.push(Prisma.sql`te.trip_id = ${sourceTripId}`);
    }

    if (query) {
      const pattern = `%${query}%`;
      whereConditions.push(
        Prisma.sql`(te.description ILIKE ${pattern} OR COALESCE(te.label, '') ILIKE ${pattern} OR t.name ILIKE ${pattern})`,
      );
    }

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: string;
          date: Date;
          description: string;
          label: string | null;
          amountOut: unknown;
          localCurrency: string;
          sourceTripId: string;
          sourceTripName: string;
        }>
      >`
        SELECT
          te.id,
          te.transaction_date AS date,
          te.description,
          te.label,
          te.local_amount AS "amountOut",
          te.local_currency AS "localCurrency",
          te.trip_id AS "sourceTripId",
          t.name AS "sourceTripName"
        FROM trip_entries te
        INNER JOIN trips t ON t.id = te.trip_id
        WHERE ${Prisma.join(whereConditions, " AND ")}
        ORDER BY te.transaction_date DESC, te.id DESC
        LIMIT ${cappedLimit}
        OFFSET ${cappedOffset}
      `,
      prisma.$queryRaw<Array<{ total: bigint | number }>>`
        SELECT COUNT(*)::bigint AS total
        FROM trip_entries te
        INNER JOIN trips t ON t.id = te.trip_id
        WHERE ${Prisma.join(whereConditions, " AND ")}
      `,
    ]);

    return {
      transactions: rows.map((row) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        label: row.label,
        amountIn: null,
        amountOut: row.amountOut !== null ? Number(row.amountOut) : null,
        accountIdentifier: null,
        category: null,
        metadata: {
          sourceTripId: row.sourceTripId,
          sourceTripName: row.sourceTripName,
          localCurrency: row.localCurrency,
        },
      })),
      total: Number(countRows[0]?.total || 0),
    };
  }

  static async addFundingsFromOutgoingEntries(
    userId: string,
    tripId: string,
    sourceEntryIds: string[],
    walletId?: string | null,
  ) {
    const uniqueIds = Array.from(new Set(sourceEntryIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new Error("No outgoing entries selected");
    }

    const [trip] = await prisma.$queryRaw<Array<{ id: string; baseCurrency: string }>>`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!trip) {
      throw new Error("Trip not found or unauthorized");
    }

    if (walletId) {
      const [wallet] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT w.id
        FROM wallets w
        INNER JOIN trips t ON t.id = w.trip_id
        WHERE w.id = ${walletId} AND w.trip_id = ${tripId} AND t.user_id = ${userId}
        LIMIT 1
      `;
      if (!wallet) {
        throw new Error("Wallet not found or unauthorized");
      }
    }

    const sourceRows = await prisma.$queryRaw<
      Array<{
        id: string;
        sourceTripId: string;
        sourceTripName: string;
        date: Date;
        description: string;
        label: string | null;
        localCurrency: string;
        localAmount: unknown;
        baseAmount: unknown;
        fxRate: unknown;
        metadata: unknown;
      }>
    >`
      SELECT
        te.id,
        te.trip_id AS "sourceTripId",
        t.name AS "sourceTripName",
        te.transaction_date AS date,
        te.description,
        te.label,
        te.local_currency AS "localCurrency",
        te.local_amount AS "localAmount",
        te.base_amount AS "baseAmount",
        te.fx_rate AS "fxRate",
        te.metadata
      FROM trip_entries te
      INNER JOIN trips t ON t.id = te.trip_id
      WHERE
        te.id IN (${Prisma.join(uniqueIds)})
        AND te.type = 'funding_out'
        AND te.trip_id <> ${tripId}
        AND t.user_id = ${userId}
    `;

    const existingRows = await prisma.$queryRaw<Array<{ sourceTripEntryId: string }>>`
      SELECT COALESCE(tf.metadata->>'sourceTripEntryId', '') AS "sourceTripEntryId"
      FROM trip_fundings tf
      WHERE
        tf.trip_id = ${tripId}
        AND COALESCE(tf.metadata->>'sourceTripEntryId', '') IN (${Prisma.join(uniqueIds)})
    `;
    const existingSet = new Set(existingRows.map((row) => row.sourceTripEntryId));

    const toNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const toCurrency = (value: unknown, fallback: string): string => {
      const raw = String(value ?? fallback).trim().toUpperCase();
      return raw || fallback.toUpperCase();
    };

    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const source of sourceRows) {
        if (existingSet.has(source.id)) continue;
        const fundingId = randomUUID();

        const sourceMetadata =
          source.metadata && typeof source.metadata === "object"
            ? (source.metadata as Record<string, unknown>)
            : {};
        const fundingOutMetadata =
          sourceMetadata.fundingOut &&
          typeof sourceMetadata.fundingOut === "object"
            ? (sourceMetadata.fundingOut as Record<string, unknown>)
            : {};

        const localAmount = Number(source.localAmount || 0);
        if (!(localAmount > 0)) continue;

        const destinationCurrency = toCurrency(
          fundingOutMetadata.destinationCurrency,
          source.localCurrency || trip.baseCurrency,
        );
        const destinationAmount =
          toNumber(fundingOutMetadata.destinationAmount) || localAmount;
        const sourceCurrency = destinationCurrency;
        const sourceAmount = destinationAmount;
        const fxRate = toNumber(fundingOutMetadata.fxRate) || 1;
        const baseAmount = toNumber(source.baseAmount) || sourceAmount;
        const feeAmount = toNumber(fundingOutMetadata.feeAmount);
        const feeCurrency =
          feeAmount && feeAmount > 0
            ? toCurrency(fundingOutMetadata.feeCurrency, destinationCurrency)
            : null;

        await tx.$executeRaw`
          INSERT INTO trip_fundings (
            id,
            trip_id,
            wallet_id,
            entry_id,
            bank_transaction_id,
            source_type,
            source_currency,
            source_amount,
            destination_currency,
            destination_amount,
            fx_rate,
            base_amount,
            fee_amount,
            fee_currency,
            metadata,
            created_at
          )
          VALUES (
            ${fundingId},
            ${tripId},
            ${walletId ?? null},
            NULL,
            NULL,
            'from_trip_outgoing',
            ${sourceCurrency},
            ${sourceAmount},
            ${destinationCurrency},
            ${destinationAmount},
            ${fxRate},
            ${baseAmount},
            ${feeAmount ?? null},
            ${feeCurrency},
            ${{
              importedFromTripOutgoing: true,
              sourceTripEntryId: source.id,
              sourceTripId: source.sourceTripId,
              sourceTripName: source.sourceTripName,
              sourceTripDate: source.date,
              sourceTripDescription: source.description,
              sourceTripLabel: source.label,
              sourceMetadata,
              matchReviewStatus: "confirmed",
            } as Prisma.InputJsonValue},
            NOW()
          )
        `;
        await TripRepository.upsertFundingEntryTx(
          tx,
          userId,
          tripId,
          fundingId,
        );
        created += 1;
      }
    });

    if (walletId && created > 0) {
      await TripRepository.recalculateWalletEntriesToBase(userId, tripId, walletId, {
        mode: "weighted",
      }).catch(() => null);
    }

    return { created };
  }

  static async addEntriesFromSourceTransactions(
    userId: string,
    tripId: string,
    input: {
      transactionIds: string[];
      categoryId?: string | null;
      entryType?: "spending" | "reimbursement" | "funding_out";
      fundingOut?: {
        destinationType?: "bank" | "trip" | "external";
        destinationTripId?: string | null;
        bankTransactionId?: string | null;
        destinationCurrency?: string | null;
        destinationAmount?: number | null;
        fxRate?: number | null;
        feeAmount?: number | null;
        feeCurrency?: string | null;
      } | null;
    },
  ) {
    const uniqueIds = Array.from(new Set(input.transactionIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new Error("No transactions selected");
    }

    const [trip] = await prisma.$queryRaw<Array<{ id: string; baseCurrency: string }>>`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!trip) {
      throw new Error("Trip not found or unauthorized");
    }

    if (input.categoryId) {
      const [category] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM categories
        WHERE id = ${input.categoryId} AND user_id = ${userId}
        LIMIT 1
      `;
      if (!category) {
        throw new Error("Category not found or unauthorized");
      }
    }

    const existingRows = await prisma.$queryRaw<Array<{ sourceTransactionId: string }>>`
      SELECT source_transaction_id AS "sourceTransactionId"
      FROM trip_entries
      WHERE trip_id = ${tripId} AND source_transaction_id IN (${Prisma.join(uniqueIds)})
    `;
    const existing = new Set(existingRows.map((row) => row.sourceTransactionId));

    const sourceTransactions = await prisma.$queryRaw<
      Array<{
        id: string;
        date: Date;
        description: string;
        label: string | null;
        amountIn: unknown;
        amountOut: unknown;
        metadata: unknown;
      }>
    >`
      SELECT
        t.id,
        t.date,
        t.description,
        t.label,
        t.amount_in AS "amountIn",
        t.amount_out AS "amountOut",
        t.metadata
      FROM transactions t
      WHERE t.user_id = ${userId} AND t.id IN (${Prisma.join(uniqueIds)})
    `;

    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const source of sourceTransactions) {
        if (existing.has(source.id)) continue;

        const amountOut = source.amountOut !== null ? Number(source.amountOut) : 0;
        const amountIn = source.amountIn !== null ? Number(source.amountIn) : 0;
        const resolvedType =
          input.entryType ??
          (amountOut > 0 ? "spending" : amountIn > 0 ? "reimbursement" : null);

        if (!resolvedType) continue;

        if (resolvedType === "spending" && !(amountOut > 0)) {
          throw new Error(
            "Selected bank transaction must be a debit (amount out) to add as trip spending.",
          );
        }
        if (resolvedType === "reimbursement" && !(amountIn > 0)) {
          throw new Error(
            "Selected bank transaction must be a credit (amount in) to add as trip reimbursement.",
          );
        }
        if (resolvedType === "funding_out" && !(amountIn > 0)) {
          throw new Error(
            "Selected bank transaction must be a credit (amount in) to add as trip funding out.",
          );
        }

        const baseAmount =
          resolvedType === "spending" ? amountOut : amountIn;
        if (!(baseAmount > 0)) continue;

        let fundingOutMetadata: Record<string, unknown> | null = null;
        let normalizedFundingOut:
          | Awaited<ReturnType<typeof TripRepository.normalizeFundingOutConfig>>
          | null = null;
        const fundingOutSourceCurrency = trip.baseCurrency;
        const fundingOutSourceAmount = baseAmount;
        if (resolvedType === "funding_out") {
          const requestedDestinationType = String(
            input.fundingOut?.destinationType || "bank",
          ).toLowerCase() as "bank" | "trip" | "external";
          const defaultBankTransactionId =
            requestedDestinationType === "bank" ? source.id : null;

          normalizedFundingOut = await TripRepository.normalizeFundingOutConfig(
            tx,
            userId,
            {
              tripBaseCurrency: trip.baseCurrency,
              sourceCurrency: fundingOutSourceCurrency,
              sourceAmount: fundingOutSourceAmount,
              sourceBaseAmount: baseAmount,
              fundingOut: {
                destinationType: requestedDestinationType,
                destinationTripId: input.fundingOut?.destinationTripId ?? null,
                bankTransactionId:
                  input.fundingOut?.bankTransactionId ?? defaultBankTransactionId,
                destinationCurrency:
                  input.fundingOut?.destinationCurrency ?? trip.baseCurrency,
                destinationAmount: input.fundingOut?.destinationAmount ?? null,
                fxRate: input.fundingOut?.fxRate ?? null,
                feeAmount: input.fundingOut?.feeAmount ?? null,
                feeCurrency: input.fundingOut?.feeCurrency ?? null,
              },
            },
          );
          fundingOutMetadata = {
            destinationType: normalizedFundingOut.destinationType,
            destinationTripId: normalizedFundingOut.destinationTripId,
            bankTransactionId: normalizedFundingOut.bankTransactionId,
            destinationCurrency: normalizedFundingOut.destinationCurrency,
            destinationAmount: normalizedFundingOut.destinationAmount,
            fxRate: normalizedFundingOut.fxRate,
            feeAmount: normalizedFundingOut.feeAmount,
            feeCurrency: normalizedFundingOut.feeCurrency,
            autoLinkedBankCredit:
              normalizedFundingOut.bankTransactionId === source.id,
          };
        }

        const metadataPayload = {
          importedFromMainTransactions: true,
          sourceTransactionId: source.id,
          sourceMetadata: source.metadata ?? null,
          ...(resolvedType === "funding_out" && fundingOutMetadata
            ? {
                fundingOut: fundingOutMetadata,
              }
            : {}),
        } as Prisma.InputJsonValue;

        const entryId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO trip_entries (
            id,
            trip_id,
            wallet_id,
            source_type,
            source_transaction_id,
            type,
            transaction_date,
            description,
            label,
            local_currency,
            local_amount,
            fx_rate,
            base_amount,
            fee_amount,
            fee_currency,
            category_id,
            linked_entry_id,
            metadata,
            created_at
          )
          VALUES (
            ${entryId},
            ${tripId},
            NULL,
            ${resolvedType === "funding_out"
              ? "external_bank_funding_out"
              : "external_bank"},
            ${source.id},
            ${resolvedType},
            ${source.date},
            ${source.description},
            ${source.label},
            ${trip.baseCurrency},
            ${baseAmount},
            1,
            ${baseAmount},
            NULL,
            NULL,
            ${resolvedType === "spending" ? input.categoryId ?? null : null},
            NULL,
            ${metadataPayload},
            NOW()
          )
        `;

        created += 1;
      }
    });

    return { created };
  }

  static async createTripEntry(
    userId: string,
    tripId: string,
    input: {
      walletId?: string | null;
      type: "spending" | "reimbursement" | "funding_out";
      date: Date;
      description: string;
      label?: string | null;
      categoryId?: string | null;
      localCurrency: string;
      localAmount: number;
      baseAmount: number;
      fxRate?: number | null;
      feeAmount?: number | null;
      feeCurrency?: string | null;
      fundingOut?: {
        destinationType?: "bank" | "trip" | "external";
        destinationTripId?: string | null;
        bankTransactionId?: string | null;
        destinationCurrency?: string | null;
        destinationAmount?: number | null;
        fxRate?: number | null;
        feeAmount?: number | null;
        feeCurrency?: string | null;
      } | null;
      metadata?: Prisma.InputJsonValue | null;
    },
  ) {
    const [trip] = await prisma.$queryRaw<Array<{ id: string; baseCurrency: string }>>`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!trip) {
      throw new Error("Trip not found or unauthorized");
    }

    if (input.walletId) {
      const [wallet] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT w.id
        FROM wallets w
        INNER JOIN trips t ON t.id = w.trip_id
        WHERE w.id = ${input.walletId} AND w.trip_id = ${tripId} AND t.user_id = ${userId}
        LIMIT 1
      `;
      if (!wallet) {
        throw new Error("Wallet not found or unauthorized");
      }
    }

    if (input.type === "spending" && input.categoryId) {
      const [category] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM categories
        WHERE id = ${input.categoryId} AND user_id = ${userId}
        LIMIT 1
      `;
      if (!category) {
        throw new Error("Category not found or unauthorized");
      }
    }

    const id = randomUUID();
    const resolvedFxRate =
      input.fxRate !== null && input.fxRate !== undefined
        ? input.fxRate
        : input.localAmount > 0
          ? input.baseAmount / input.localAmount
          : 1;

    const normalizedFundingOut =
      input.type === "funding_out"
        ? await TripRepository.normalizeFundingOutConfig(
            prisma,
            userId,
            {
              tripBaseCurrency: trip.baseCurrency,
              sourceCurrency: String(input.localCurrency || "").toUpperCase(),
              sourceAmount: Number(input.localAmount || 0),
              sourceBaseAmount: Number(input.baseAmount || 0),
              fundingOut: {
                destinationType: input.fundingOut?.destinationType || "external",
                destinationTripId: input.fundingOut?.destinationTripId ?? null,
                bankTransactionId: input.fundingOut?.bankTransactionId ?? null,
                destinationCurrency: input.fundingOut?.destinationCurrency ?? null,
                destinationAmount: input.fundingOut?.destinationAmount ?? null,
                fxRate: input.fundingOut?.fxRate ?? null,
                feeAmount: input.fundingOut?.feeAmount ?? null,
                feeCurrency: input.fundingOut?.feeCurrency ?? null,
              },
            },
          )
        : null;
    const fundingOutMetadata =
      normalizedFundingOut && input.type === "funding_out"
        ? {
            destinationType: normalizedFundingOut.destinationType,
            destinationTripId: normalizedFundingOut.destinationTripId,
            bankTransactionId: normalizedFundingOut.bankTransactionId,
            destinationCurrency: normalizedFundingOut.destinationCurrency,
            destinationAmount: normalizedFundingOut.destinationAmount,
            fxRate: normalizedFundingOut.fxRate,
            feeAmount: normalizedFundingOut.feeAmount,
            feeCurrency: normalizedFundingOut.feeCurrency,
          }
        : null;

    const metadataPayload = {
      manualEntry: true,
      ...(input.type === "funding_out" && fundingOutMetadata
        ? {
            fundingOut: fundingOutMetadata,
          }
        : {}),
      ...(input.metadata && typeof input.metadata === "object"
        ? (input.metadata as Record<string, unknown>)
        : {}),
    } satisfies Record<string, unknown>;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO trip_entries (
          id,
          trip_id,
          wallet_id,
          source_type,
          source_transaction_id,
          type,
          transaction_date,
          description,
          label,
          local_currency,
          local_amount,
          fx_rate,
          base_amount,
          fee_amount,
          fee_currency,
          category_id,
          linked_entry_id,
          metadata,
          created_at
        )
        VALUES (
          ${id},
          ${tripId},
          ${input.walletId ?? null},
          ${input.type === "funding_out"
            ? input.walletId
              ? "manual_funding_out_wallet"
              : "manual_funding_out"
            : input.walletId
              ? "manual_wallet"
              : "manual_no_wallet"},
          NULL,
          ${input.type},
          ${input.date},
          ${input.description},
          ${input.label ?? null},
          ${input.localCurrency},
          ${input.localAmount},
          ${resolvedFxRate},
          ${input.baseAmount},
          ${input.type === "funding_out" ? null : (input.feeAmount ?? null)},
          ${input.type === "funding_out" ? null : (input.feeCurrency ?? null)},
          ${input.type === "spending" ? input.categoryId ?? null : null},
          NULL,
          ${metadataPayload as Prisma.InputJsonValue},
          NOW()
        )
      `;

    });

    return { id };
  }

  static async getTripWalletSummaries(userId: string, tripId: string) {
    const tripRows = await prisma.$queryRaw<Array<{ id: string; baseCurrency: string }>>`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!tripRows[0]) throw new Error("Trip not found or unauthorized");
    const trip = tripRows[0];

    const [wallets, balanceRows, fundingBasisRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: string;
          tripId: string;
          name: string;
          currency: string;
          color: string;
        }>
      >`
        SELECT
          w.id,
          w.trip_id AS "tripId",
          w.name,
          w.currency,
          w.color
        FROM wallets w
        WHERE w.trip_id = ${tripId}
        ORDER BY w.name ASC
      `,
      prisma.$queryRaw<
        Array<{
          walletId: string;
          currency: string;
          amount: unknown;
        }>
      >`
        SELECT
          te.wallet_id AS "walletId",
          te.local_currency AS currency,
          SUM(
            CASE
              WHEN te.type = 'funding_in' THEN
                CASE
                  WHEN te.source_type IN ('funding_in_imported_topup', 'funding_in_opening_balance')
                    AND COALESCE(te.metadata->>'matchReviewStatus', '') NOT IN ('accepted', 'replaced', 'confirmed')
                  THEN 0::numeric
                  ELSE te.local_amount
                END
              WHEN te.type = 'reimbursement' THEN te.local_amount
              WHEN te.type = 'spending' THEN -te.local_amount
              WHEN te.type = 'funding_out' THEN -te.local_amount
              ELSE 0::numeric
            END
          ) AS amount
        FROM trip_entries te
        WHERE te.trip_id = ${tripId} AND te.wallet_id IS NOT NULL
        GROUP BY te.wallet_id, te.local_currency
      `,
      prisma.$queryRaw<
        Array<{
          walletId: string;
          baseTotal: unknown;
          localTotal: unknown;
        }>
      >`
        SELECT
          tf.wallet_id AS "walletId",
          SUM(
            COALESCE(
              tf.base_amount,
              CASE
                WHEN UPPER(tf.source_currency) = UPPER(t.base_currency) THEN tf.source_amount
                WHEN UPPER(tf.destination_currency) = UPPER(t.base_currency) THEN tf.destination_amount
                ELSE tf.source_amount
              END
            )
          ) AS "baseTotal",
          SUM(
            CASE
              WHEN UPPER(tf.destination_currency) = UPPER(w.currency) THEN tf.destination_amount
              ELSE 0::numeric
            END
          ) AS "localTotal"
        FROM trip_fundings tf
        INNER JOIN wallets w ON w.id = tf.wallet_id
        INNER JOIN trips t ON t.id = tf.trip_id
        WHERE
          tf.trip_id = ${tripId}
          AND tf.wallet_id IS NOT NULL
          AND (
            tf.source_type NOT IN ('imported_topup', 'opening_balance')
            OR COALESCE(tf.metadata->>'matchReviewStatus', '') IN ('accepted', 'replaced', 'confirmed')
          )
        GROUP BY tf.wallet_id
      `,
    ]);

    const balanceMap = new Map<string, Array<{ currency: string; amount: number }>>();
    balanceRows.forEach((row) => {
      const existing = balanceMap.get(row.walletId) || [];
      existing.push({
        currency: row.currency,
        amount: Number(row.amount),
      });
      balanceMap.set(row.walletId, existing);
    });

    const fundingBasisMap = new Map<
      string,
      {
        baseTotal: number;
        localTotal: number;
      }
    >();
    fundingBasisRows.forEach((row) => {
      fundingBasisMap.set(row.walletId, {
        baseTotal: Number(row.baseTotal || 0),
        localTotal: Number(row.localTotal || 0),
      });
    });

    return wallets.map((wallet) => ({
      ...((): { intrinsicFxRate: number | null; intrinsicBaseValue: number | null } => {
        const basis = fundingBasisMap.get(wallet.id);
        const intrinsicFxRate =
          wallet.currency.toUpperCase() === trip.baseCurrency.toUpperCase()
            ? 1
            : basis && basis.baseTotal > 0 && basis.localTotal > 0
              ? basis.baseTotal / basis.localTotal
              : null;
        const walletCurrencyBalance = (balanceMap.get(wallet.id) || [])
          .filter(
            (balance) =>
              String(balance.currency).toUpperCase() ===
              String(wallet.currency).toUpperCase(),
          )
          .reduce((sum, balance) => sum + balance.amount, 0);
        const intrinsicBaseValue =
          intrinsicFxRate && Number.isFinite(intrinsicFxRate)
            ? Number((walletCurrencyBalance * intrinsicFxRate).toFixed(4))
            : null;
        return { intrinsicFxRate, intrinsicBaseValue };
      })(),
      id: wallet.id,
      tripId: wallet.tripId,
      name: wallet.name,
      currency: wallet.currency,
      color: wallet.color,
      balances: balanceMap.get(wallet.id) || [],
    }));
  }

  static async getTripEntries(
    userId: string,
    tripId: string,
    filters?: {
      search?: string;
      walletId?: string;
      categoryId?: string;
      type?: "spending" | "reimbursement" | "funding_out" | "funding_in";
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const tripRows = await prisma.$queryRaw<Array<{ id: string; baseCurrency: string }>>`
      SELECT id, base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!tripRows[0]) throw new Error("Trip not found or unauthorized");
    const trip = tripRows[0];

    const search = filters?.search?.trim();
    const dateFrom = filters?.dateFrom;
    const dateTo = filters?.dateTo;
    const where: Prisma.Sql[] = [Prisma.sql`te.trip_id = ${tripId}`];

    if (filters?.walletId) {
      where.push(Prisma.sql`te.wallet_id = ${filters.walletId}`);
    }

    if (filters?.categoryId) {
      where.push(TripRepository.buildTripCategoryFilterSql(filters.categoryId));
    }

    if (filters?.type) {
      where.push(Prisma.sql`te.type = ${filters.type}`);
    }

    if (dateFrom) {
      where.push(Prisma.sql`te.transaction_date >= ${dateFrom}`);
    }

    if (dateTo) {
      where.push(Prisma.sql`te.transaction_date <= ${dateTo}`);
    }

    if (search) {
      const pattern = `%${search}%`;
      where.push(
        Prisma.sql`(te.description ILIKE ${pattern} OR COALESCE(te.label, '') ILIKE ${pattern})`,
      );
    }

    const entries = await prisma.$queryRaw<
      Array<{
        id: string;
        type: "spending" | "reimbursement" | "funding_out" | "funding_in";
        date: Date;
        label: string | null;
        description: string;
        walletId: string | null;
        walletName: string | null;
        walletCurrency: string | null;
        walletColor: string | null;
        sourceType: string;
        sourceTransactionId: string | null;
        categoryId: string | null;
        categoryName: string | null;
        categoryColor: string | null;
        localCurrency: string;
        localAmount: unknown;
        baseAmount: unknown;
        fxRate: unknown;
        feeAmount: unknown;
        feeCurrency: string | null;
        fundingId: string | null;
        fundingSourceType: string | null;
        fundingBankTransactionId: string | null;
        fundingBankTransactionDate: Date | null;
        fundingBankTransactionDescription: string | null;
        metadata: unknown;
      }>
    >`
      SELECT
        te.id,
        te.type,
        te.transaction_date AS date,
        te.label,
        te.description,
        te.source_type AS "sourceType",
        te.source_transaction_id AS "sourceTransactionId",
        w.id AS "walletId",
        w.name AS "walletName",
        w.currency AS "walletCurrency",
        w.color AS "walletColor",
        c.id AS "categoryId",
        c.name AS "categoryName",
        c.color AS "categoryColor",
        te.local_currency AS "localCurrency",
        te.local_amount AS "localAmount",
        te.base_amount AS "baseAmount",
        te.fx_rate AS "fxRate",
        te.fee_amount AS "feeAmount",
        te.fee_currency AS "feeCurrency",
        tf.id AS "fundingId",
        tf.source_type AS "fundingSourceType",
        bt.id AS "fundingBankTransactionId",
        bt.date AS "fundingBankTransactionDate",
        bt.description AS "fundingBankTransactionDescription",
        te.metadata
      FROM trip_entries te
      LEFT JOIN wallets w ON w.id = te.wallet_id
      LEFT JOIN categories c ON c.id = te.category_id
      LEFT JOIN trip_fundings tf ON tf.entry_id = te.id
      LEFT JOIN transactions bt ON bt.id = tf.bank_transaction_id
      INNER JOIN trips t ON t.id = te.trip_id
      WHERE ${Prisma.join(where, " AND ")} AND t.user_id = ${userId}
      ORDER BY te.transaction_date DESC
    `;

    const items = entries.map((item) => ({
      id: item.id,
      type: item.type,
      date: item.date,
      label: item.label,
      description: item.description,
      wallet: {
        id: item.walletId ?? "__external__",
        name:
          item.walletName ??
          (item.sourceType === "external_bank" ? "Bank Account" : "No Wallet"),
        currency: item.walletCurrency ?? trip.baseCurrency,
        color: item.walletColor ?? "#ffffff",
      },
      category:
        item.type === "reimbursement"
          ? {
              id: "__reimbursement__",
              name: "Reimbursement",
              color: "#22c55e",
            }
          : item.type === "funding_in"
            ? {
                id: "__funding_in__",
                name: "Funding In",
                color: "#3b82f6",
              }
          : item.type === "funding_out"
            ? {
                id: "__funding_out__",
                name: "Funding Out",
                color: "#f59e0b",
              }
          : item.categoryId
            ? {
                id: item.categoryId,
                name: item.categoryName,
                color: item.categoryColor ?? "#94a3b8",
              }
            : null,
      localCurrency: item.localCurrency,
      localAmount: Number(item.localAmount),
      baseAmount: Number(item.baseAmount),
      fxRate: Number(item.fxRate),
      feeAmount: item.feeAmount !== null ? Number(item.feeAmount) : null,
      feeCurrency: item.feeCurrency,
      metadata: {
        ...(item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : {}),
        sourceType: item.sourceType,
        sourceTransactionId: item.sourceTransactionId,
        fundingId: item.fundingId,
        fundingSourceType: item.fundingSourceType,
        bankTransactionId: item.fundingBankTransactionId,
        bankTransactionDate: item.fundingBankTransactionDate,
        bankTransactionDescription: item.fundingBankTransactionDescription,
      },
    }));

    const total = items.length;
    const offset = Math.max(0, filters?.offset ?? 0);
    const limit = Math.max(1, Math.min(filters?.limit ?? 50, 200));
    const paged = items.slice(offset, offset + limit);

    return {
      items: paged,
      total,
    };
  }

  static async searchTripEntriesForReimbursement(
    userId: string,
    tripId: string,
    search?: string,
    limit: number = 20,
    offset: number = 0,
    excludeEntryId?: string,
  ) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const safeOffset = Math.max(0, offset);
    const where: Prisma.Sql[] = [
      Prisma.sql`te.trip_id = ${tripId}`,
      Prisma.sql`te.type = 'spending'`,
    ];
    if (excludeEntryId) {
      where.push(Prisma.sql`te.id <> ${excludeEntryId}`);
    }
    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const pattern = `%${trimmedSearch}%`;
      where.push(
        Prisma.sql`(te.description ILIKE ${pattern} OR COALESCE(te.label, '') ILIKE ${pattern})`,
      );
    }

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: string;
          date: Date;
          description: string;
          label: string | null;
          localAmount: unknown;
          localCurrency: string;
          baseAmount: unknown;
          walletName: string | null;
          allocatedBase: unknown;
        }>
      >`
        SELECT
          te.id,
          te.transaction_date AS date,
          te.description,
          te.label,
          te.local_amount AS "localAmount",
          te.local_currency AS "localCurrency",
          te.base_amount AS "baseAmount",
          w.name AS "walletName",
          COALESCE((
            SELECT SUM(a.amount_base)
            FROM trip_reimbursement_allocations a
            WHERE a.reimbursed_entry_id = te.id
          ), 0) AS "allocatedBase"
        FROM trip_entries te
        INNER JOIN trips t ON t.id = te.trip_id
        LEFT JOIN wallets w ON w.id = te.wallet_id
        WHERE ${Prisma.join(where, " AND ")} AND t.user_id = ${userId}
        ORDER BY te.transaction_date DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `,
      prisma.$queryRaw<Array<{ total: unknown }>>`
        SELECT COUNT(*)::int AS total
        FROM trip_entries te
        INNER JOIN trips t ON t.id = te.trip_id
        WHERE ${Prisma.join(where, " AND ")} AND t.user_id = ${userId}
      `,
    ]);

    return {
      transactions: rows.map((row) => {
        const baseAmount = Number(row.baseAmount || 0);
        const alreadyAllocatedBase = Number(row.allocatedBase || 0);
        return {
          id: row.id,
          date: row.date,
          description: row.description,
          label: row.label,
          localAmount: Number(row.localAmount || 0),
          localCurrency: row.localCurrency,
          baseAmount,
          alreadyAllocatedBase,
          remainingBase: Number(
            Math.max(baseAmount - alreadyAllocatedBase, 0).toFixed(4),
          ),
          walletName: row.walletName,
        };
      }),
      total: Number(countRows[0]?.total || 0),
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  static async createTripReimbursementLink(
    userId: string,
    tripId: string,
    reimbursementEntryId: string,
    allocations: Array<{ transactionId: string; amountBase: number }>,
    leftoverCategoryId?: string | null,
    valuation?: {
      reimbursementBaseAmount?: number | null;
      reimbursingFxRate?: number | null;
    },
  ) {
    const [trip] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!trip) throw new Error("Trip not found or unauthorized");

    await prisma.$transaction(async (tx) => {
      await TripRepository.applyTripReimbursementAllocations(
        tx,
        tripId,
        reimbursementEntryId,
        allocations,
        leftoverCategoryId ?? null,
        valuation,
      );
    });

    return { success: true };
  }

  static async clearTripEntryLinkage(
    userId: string,
    tripId: string,
    entryId: string,
  ) {
    const [entry] = await prisma.$queryRaw<
      Array<{ id: string; metadata: unknown }>
    >`
      SELECT te.id, te.metadata
      FROM trip_entries te
      INNER JOIN trips t ON t.id = te.trip_id
      WHERE te.id = ${entryId} AND te.trip_id = ${tripId} AND t.user_id = ${userId}
      LIMIT 1
    `;
    if (!entry) throw new Error("Trip entry not found or unauthorized");

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM trip_reimbursement_allocations
        WHERE
          trip_id = ${tripId}
          AND (reimbursement_entry_id = ${entryId} OR reimbursed_entry_id = ${entryId})
      `;

      const [allRows] = await Promise.all([
        tx.$queryRaw<Array<{ id: string; metadata: unknown }>>`
          SELECT id, metadata
          FROM trip_entries
          WHERE trip_id = ${tripId}
            AND id IN (
              SELECT reimbursement_entry_id FROM trip_reimbursement_allocations WHERE trip_id = ${tripId}
              UNION
              SELECT reimbursed_entry_id FROM trip_reimbursement_allocations WHERE trip_id = ${tripId}
            )
        `,
      ]);

      // Rebuild linkages for impacted rows from remaining allocation records.
      const impactedIds = new Set<string>([entryId, ...allRows.map((row) => row.id)]);
      for (const id of impactedIds) {
        const metadata =
          allRows.find((row) => row.id === id)?.metadata &&
          typeof allRows.find((row) => row.id === id)?.metadata === "object"
            ? {
                ...(allRows.find((row) => row.id === id)?.metadata as Record<
                  string,
                  unknown
                >),
              }
            : {};

        const [asReimburser, asTarget] = await Promise.all([
          tx.$queryRaw<
            Array<{
              reimbursedEntryId: string;
              amountBase: unknown;
              reimbursingLocalAmount: unknown;
              reimbursedLocalAmount: unknown;
              reimbursingFxRate: unknown;
              reimbursedFxRate: unknown;
              reimbursedCurrency: string;
            }>
          >`
            SELECT
              a.reimbursed_entry_id AS "reimbursedEntryId",
              a.amount_base AS "amountBase",
              a.reimbursing_local_amount AS "reimbursingLocalAmount",
              a.reimbursed_local_amount AS "reimbursedLocalAmount",
              a.reimbursing_fx_rate AS "reimbursingFxRate",
              a.reimbursed_fx_rate AS "reimbursedFxRate",
              te.local_currency AS "reimbursedCurrency"
            FROM trip_reimbursement_allocations a
            INNER JOIN trip_entries te ON te.id = a.reimbursed_entry_id
            WHERE a.trip_id = ${tripId} AND a.reimbursement_entry_id = ${id}
          `,
          tx.$queryRaw<
            Array<{
              reimbursementEntryId: string;
              amountBase: unknown;
              reimbursingLocalAmount: unknown;
              reimbursedLocalAmount: unknown;
              reimbursingFxRate: unknown;
              reimbursedFxRate: unknown;
              reimbursingCurrency: string;
            }>
          >`
            SELECT
              a.reimbursement_entry_id AS "reimbursementEntryId",
              a.amount_base AS "amountBase",
              a.reimbursing_local_amount AS "reimbursingLocalAmount",
              a.reimbursed_local_amount AS "reimbursedLocalAmount",
              a.reimbursing_fx_rate AS "reimbursingFxRate",
              a.reimbursed_fx_rate AS "reimbursedFxRate",
              te.local_currency AS "reimbursingCurrency"
            FROM trip_reimbursement_allocations a
            INNER JOIN trip_entries te ON te.id = a.reimbursement_entry_id
            WHERE a.trip_id = ${tripId} AND a.reimbursed_entry_id = ${id}
          `,
        ]);

        const parsedLinkage = TripRepository.parseTripEntryLinkage(
          (metadata as Record<string, unknown>).linkage,
        );
        if (asReimburser.length > 0) {
          (metadata as Record<string, unknown>).linkage = {
            type: "reimbursement",
            reimbursesAllocations: asReimburser.map((row) => ({
              transactionId: row.reimbursedEntryId,
              amountBase: Number(row.amountBase || 0),
              reimbursingLocalAmount: Number(row.reimbursingLocalAmount || 0),
              reimbursedLocalAmount: Number(row.reimbursedLocalAmount || 0),
              reimbursingFxRate: Number(row.reimbursingFxRate || 0),
              reimbursedFxRate: Number(row.reimbursedFxRate || 0),
              reimbursedCurrency: row.reimbursedCurrency,
            })),
            leftoverBaseAmount: parsedLinkage?.leftoverBaseAmount ?? null,
            leftoverCategoryId: parsedLinkage?.leftoverCategoryId ?? null,
          } as TripEntryLinkage;
        } else if (asTarget.length > 0) {
          (metadata as Record<string, unknown>).linkage = {
            type: "reimbursed",
            reimbursedByAllocations: asTarget.map((row) => ({
              transactionId: row.reimbursementEntryId,
              amountBase: Number(row.amountBase || 0),
              reimbursingLocalAmount: Number(row.reimbursingLocalAmount || 0),
              reimbursedLocalAmount: Number(row.reimbursedLocalAmount || 0),
              reimbursingFxRate: Number(row.reimbursingFxRate || 0),
              reimbursedFxRate: Number(row.reimbursedFxRate || 0),
              reimbursingCurrency: row.reimbursingCurrency,
            })),
          } as TripEntryLinkage;
        } else {
          delete (metadata as Record<string, unknown>).linkage;
        }

        await tx.$executeRaw`
          UPDATE trip_entries
          SET metadata = ${metadata as Prisma.InputJsonValue}
          WHERE id = ${id} AND trip_id = ${tripId}
        `;
      }
    });

    return { success: true };
  }

  static async bulkUpdateEntriesByIds(
    userId: string,
    tripId: string,
    ids: string[],
    updates: { categoryId?: string | null; date?: Date },
  ) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return { count: 0 };

    const setClauses: Prisma.Sql[] = [];
    if (updates.categoryId !== undefined) {
      setClauses.push(Prisma.sql`category_id = ${updates.categoryId}`);
    }
    if (updates.date) {
      setClauses.push(Prisma.sql`transaction_date = ${updates.date}`);
    }
    if (setClauses.length === 0) return { count: 0 };

    const updatedCount = await prisma.$executeRaw`
      UPDATE trip_entries te
      SET ${Prisma.join(setClauses, ", ")}
      FROM trips t
      WHERE
        te.trip_id = t.id
        AND t.user_id = ${userId}
        AND te.trip_id = ${tripId}
        AND te.id IN (${Prisma.join(uniqueIds)})
    `;

    return { count: Number(updatedCount) };
  }

  static async bulkUpdateEntriesByFilter(
    userId: string,
    tripId: string,
    filters: {
      search?: string;
      walletId?: string;
      categoryId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    excludeIds: string[] | undefined,
    updates: { categoryId?: string | null; date?: Date },
  ) {
    const setClauses: Prisma.Sql[] = [];
    if (updates.categoryId !== undefined) {
      setClauses.push(Prisma.sql`category_id = ${updates.categoryId}`);
    }
    if (updates.date) {
      setClauses.push(Prisma.sql`transaction_date = ${updates.date}`);
    }
    if (setClauses.length === 0) return { count: 0 };

    const where: Prisma.Sql[] = [
      Prisma.sql`te.trip_id = ${tripId}`,
      Prisma.sql`t.user_id = ${userId}`,
    ];
    const search = filters.search?.trim();
    if (filters.walletId) {
      where.push(Prisma.sql`te.wallet_id = ${filters.walletId}`);
    }
    if (filters.categoryId) {
      where.push(TripRepository.buildTripCategoryFilterSql(filters.categoryId));
    }
    if (filters.dateFrom) {
      where.push(Prisma.sql`te.transaction_date >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      where.push(Prisma.sql`te.transaction_date <= ${filters.dateTo}`);
    }
    if (search) {
      const pattern = `%${search}%`;
      where.push(
        Prisma.sql`(te.description ILIKE ${pattern} OR COALESCE(te.label, '') ILIKE ${pattern})`,
      );
    }
    const uniqueExcludeIds = Array.from(new Set((excludeIds || []).filter(Boolean)));
    if (uniqueExcludeIds.length > 0) {
      where.push(Prisma.sql`te.id NOT IN (${Prisma.join(uniqueExcludeIds)})`);
    }

    const updatedCount = await prisma.$executeRaw`
      UPDATE trip_entries te
      SET ${Prisma.join(setClauses, ", ")}
      FROM trips t
      WHERE te.trip_id = t.id AND ${Prisma.join(where, " AND ")}
    `;

    return { count: Number(updatedCount) };
  }

  static async bulkDeleteEntriesByIds(
    userId: string,
    tripId: string,
    ids: string[],
  ) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return { count: 0 };

    const deletedCount = await prisma.$executeRaw`
      DELETE FROM trip_entries te
      USING trips t
      WHERE
        te.trip_id = t.id
        AND t.user_id = ${userId}
        AND te.trip_id = ${tripId}
        AND te.id IN (${Prisma.join(uniqueIds)})
    `;

    return { count: Number(deletedCount) };
  }

  static async bulkDeleteEntriesByFilter(
    userId: string,
    tripId: string,
    filters: {
      search?: string;
      walletId?: string;
      categoryId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    excludeIds: string[] | undefined,
  ) {
    const where: Prisma.Sql[] = [
      Prisma.sql`te.trip_id = ${tripId}`,
      Prisma.sql`t.user_id = ${userId}`,
    ];
    const search = filters.search?.trim();
    if (filters.walletId) {
      where.push(Prisma.sql`te.wallet_id = ${filters.walletId}`);
    }
    if (filters.categoryId) {
      where.push(TripRepository.buildTripCategoryFilterSql(filters.categoryId));
    }
    if (filters.dateFrom) {
      where.push(Prisma.sql`te.transaction_date >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      where.push(Prisma.sql`te.transaction_date <= ${filters.dateTo}`);
    }
    if (search) {
      const pattern = `%${search}%`;
      where.push(
        Prisma.sql`(te.description ILIKE ${pattern} OR COALESCE(te.label, '') ILIKE ${pattern})`,
      );
    }
    const uniqueExcludeIds = Array.from(new Set((excludeIds || []).filter(Boolean)));
    if (uniqueExcludeIds.length > 0) {
      where.push(Prisma.sql`te.id NOT IN (${Prisma.join(uniqueExcludeIds)})`);
    }

    const deletedCount = await prisma.$executeRaw`
      DELETE FROM trip_entries te
      USING trips t
      WHERE te.trip_id = t.id AND ${Prisma.join(where, " AND ")}
    `;

    return { count: Number(deletedCount) };
  }

  static async getTripAnalytics(userId: string, tripId: string) {
    const tripRows = await prisma.$queryRaw<
      Array<{ id: string; name: string; baseCurrency: string }>
    >`
      SELECT
        id,
        name,
        base_currency AS "baseCurrency"
      FROM trips
      WHERE id = ${tripId} AND user_id = ${userId}
      LIMIT 1
    `;

    const trip = tripRows[0];
    if (!trip) {
      throw new Error("Trip not found or unauthorized");
    }

    const [totalsRow] = await prisma.$queryRaw<
      Array<{
        totalFunding: unknown;
        totalFundingIn: unknown;
        totalFundingOut: unknown;
        totalSpent: unknown;
        totalReimbursed: unknown;
      }>
    >`
      SELECT
        COALESCE((
          SELECT SUM(te.base_amount)
          FROM trip_entries te
          WHERE
            te.trip_id = ${tripId}
            AND te.type = 'funding_in'
            AND (
              te.source_type NOT IN ('funding_in_imported_topup', 'funding_in_opening_balance')
              OR COALESCE(te.metadata->>'matchReviewStatus', '') IN ('accepted', 'replaced', 'confirmed')
            )
        ), 0) AS "totalFunding",
        COALESCE((
          SELECT SUM(te.base_amount)
          FROM trip_entries te
          WHERE
            te.trip_id = ${tripId}
            AND te.type = 'funding_in'
            AND (
              te.source_type NOT IN ('funding_in_imported_topup', 'funding_in_opening_balance')
              OR COALESCE(te.metadata->>'matchReviewStatus', '') IN ('accepted', 'replaced', 'confirmed')
            )
        ), 0) AS "totalFundingIn",
        COALESCE((
          SELECT SUM(te.base_amount)
          FROM trip_entries te
          WHERE
            te.trip_id = ${tripId}
            AND te.type = 'funding_out'
        ), 0) AS "totalFundingOut",
        COALESCE((
          SELECT SUM(te.base_amount)
          FROM trip_entries te
          WHERE
            te.trip_id = ${tripId}
            AND te.type = 'spending'
            AND te.source_type <> 'conversion_out'
        ), 0) AS "totalSpent",
        COALESCE((
          SELECT SUM(a.amount_base)
          FROM trip_reimbursement_allocations a
          INNER JOIN trip_entries te ON te.id = a.reimbursement_entry_id
          WHERE
            a.trip_id = ${tripId}
            AND te.source_type <> 'conversion_in'
        ), 0) AS "totalReimbursed"
    `;

    const highlightRows = await prisma.$queryRaw<
      Array<{ categoryKey: string | null; total: unknown }>
    >`
      SELECT
        LOWER(c.name) AS "categoryKey",
        SUM(te.base_amount) AS total
      FROM trip_entries te
      INNER JOIN trips t ON t.id = te.trip_id
      LEFT JOIN categories c ON c.id = te.category_id
      WHERE
        te.trip_id = ${tripId}
        AND te.type = 'spending'
        AND te.source_type <> 'conversion_out'
        AND t.user_id = ${userId}
        AND LOWER(c.name) IN ('flights', 'accommodation', 'accommodations', 'attractions')
      GROUP BY LOWER(c.name)
    `;

    const dailySeriesRows = await prisma.$queryRaw<
      Array<{ date: Date; spending: unknown; reimbursement: unknown }>
    >`
      WITH spending_by_day AS (
        SELECT
          DATE_TRUNC('day', te.transaction_date)::date AS day,
          SUM(te.base_amount) AS spending
        FROM trip_entries te
        INNER JOIN trips t ON t.id = te.trip_id
        WHERE
          te.trip_id = ${tripId}
          AND t.user_id = ${userId}
          AND te.type = 'spending'
          AND te.source_type <> 'conversion_out'
        GROUP BY DATE_TRUNC('day', te.transaction_date)::date
      ),
      reimbursement_by_day AS (
        SELECT
          DATE_TRUNC('day', re.transaction_date)::date AS day,
          SUM(a.amount_base) AS reimbursement
        FROM trip_reimbursement_allocations a
        INNER JOIN trip_entries re ON re.id = a.reimbursement_entry_id
        INNER JOIN trips t ON t.id = re.trip_id
        WHERE
          a.trip_id = ${tripId}
          AND t.user_id = ${userId}
          AND re.source_type <> 'conversion_in'
        GROUP BY DATE_TRUNC('day', re.transaction_date)::date
      )
      SELECT
        COALESCE(s.day, r.day) AS date,
        COALESCE(s.spending, 0::numeric) AS spending,
        COALESCE(r.reimbursement, 0::numeric) AS reimbursement
      FROM spending_by_day s
      FULL OUTER JOIN reimbursement_by_day r ON r.day = s.day
      ORDER BY COALESCE(s.day, r.day) ASC
    `;

    const categoryRows = await prisma.$queryRaw<
      Array<{ id: string | null; name: string | null; color: string | null; totalOut: unknown }>
    >`
      SELECT
        c.id,
        c.name,
        c.color,
        SUM(te.base_amount) AS "totalOut"
      FROM trip_entries te
      INNER JOIN trips t ON t.id = te.trip_id
      LEFT JOIN categories c ON c.id = te.category_id
      WHERE
        te.trip_id = ${tripId}
        AND te.type = 'spending'
        AND te.source_type <> 'conversion_out'
        AND t.user_id = ${userId}
      GROUP BY c.id, c.name, c.color
      ORDER BY SUM(te.base_amount) DESC
    `;

    const highlightTransactionsRows = await prisma.$queryRaw<
      Array<{
        id: string;
        categoryKey: string | null;
        date: Date;
        label: string | null;
        description: string;
        localCurrency: string;
        localAmount: unknown;
        baseAmount: unknown;
        walletName: string;
      }>
    >`
      SELECT
        te.id,
        LOWER(c.name) AS "categoryKey",
        te.transaction_date AS date,
        te.label,
        te.description,
        te.local_currency AS "localCurrency",
        te.local_amount AS "localAmount",
        te.base_amount AS "baseAmount",
        COALESCE(w.name, 'Bank Account') AS "walletName"
      FROM trip_entries te
      INNER JOIN trips t ON t.id = te.trip_id
      LEFT JOIN wallets w ON w.id = te.wallet_id
      LEFT JOIN categories c ON c.id = te.category_id
      WHERE
        te.trip_id = ${tripId}
        AND te.type = 'spending'
        AND te.source_type <> 'conversion_out'
        AND t.user_id = ${userId}
        AND LOWER(c.name) IN ('flights', 'accommodation', 'accommodations', 'attractions')
      ORDER BY te.transaction_date DESC
    `;

    const recentRows = await prisma.$queryRaw<
      Array<{
        id: string;
        type: "spending" | "reimbursement" | "funding_out" | "funding_in";
        date: Date;
        label: string | null;
        description: string;
        localCurrency: string;
        localAmount: unknown;
        baseAmount: unknown;
        walletName: string;
        categoryName: string | null;
        categoryColor: string | null;
      }>
    >`
      SELECT
        te.id,
        te.type,
        te.transaction_date AS date,
        te.label,
        te.description,
        te.local_currency AS "localCurrency",
        te.local_amount AS "localAmount",
        te.base_amount AS "baseAmount",
        COALESCE(w.name, 'Bank Account') AS "walletName",
        CASE
          WHEN te.type = 'funding_in' THEN 'Funding In'::text
          WHEN te.type = 'reimbursement' THEN 'Reimbursement'::text
          WHEN te.type = 'funding_out' THEN 'Funding Out'::text
          ELSE c.name
        END AS "categoryName",
        CASE
          WHEN te.type = 'funding_in' THEN '#3b82f6'::text
          WHEN te.type = 'reimbursement' THEN '#22c55e'::text
          WHEN te.type = 'funding_out' THEN '#f59e0b'::text
          ELSE c.color
        END AS "categoryColor"
      FROM trip_entries te
      LEFT JOIN wallets w ON w.id = te.wallet_id
      INNER JOIN trips t ON t.id = te.trip_id
      LEFT JOIN categories c ON c.id = te.category_id
      WHERE te.trip_id = ${tripId} AND t.user_id = ${userId}
      ORDER BY te.transaction_date DESC
      LIMIT 12
    `;

    const highlightMap = new Map<string, number>();
    for (const row of highlightRows) {
      if (!row.categoryKey) continue;
      highlightMap.set(row.categoryKey, Number(row.total));
    }

    const flights = highlightMap.get("flights") || 0;
    const accommodations =
      (highlightMap.get("accommodation") || 0) +
      (highlightMap.get("accommodations") || 0);
    const attractions = highlightMap.get("attractions") || 0;

    const totalFunding = Number(totalsRow?.totalFunding || 0);
    const totalFundingIn = Number(totalsRow?.totalFundingIn || 0);
    const totalFundingOut = Number(totalsRow?.totalFundingOut || 0);
    const totalSpent = Number(totalsRow?.totalSpent || 0);
    const totalReimbursed = Number(totalsRow?.totalReimbursed || 0);

    const highlightTransactions = {
      flights: [] as Array<{
        id: string;
        date: Date;
        label: string | null;
        description: string;
        localCurrency: string;
        localAmount: number;
        baseAmount: number;
        walletName: string;
      }>,
      accommodations: [] as Array<{
        id: string;
        date: Date;
        label: string | null;
        description: string;
        localCurrency: string;
        localAmount: number;
        baseAmount: number;
        walletName: string;
      }>,
      attractions: [] as Array<{
        id: string;
        date: Date;
        label: string | null;
        description: string;
        localCurrency: string;
        localAmount: number;
        baseAmount: number;
        walletName: string;
      }>,
    };

    for (const row of highlightTransactionsRows) {
      const normalizedKey =
        row.categoryKey === "accommodation" || row.categoryKey === "accommodations"
          ? "accommodations"
          : row.categoryKey;
      if (
        normalizedKey !== "flights" &&
        normalizedKey !== "accommodations" &&
        normalizedKey !== "attractions"
      ) {
        continue;
      }

      highlightTransactions[normalizedKey].push({
        id: row.id,
        date: row.date,
        label: row.label,
        description: row.description,
        localCurrency: row.localCurrency,
        localAmount: Number(row.localAmount || 0),
        baseAmount: Number(row.baseAmount || 0),
        walletName: row.walletName,
      });
    }

    return {
      trip: {
        id: trip.id,
        name: trip.name,
        baseCurrency: trip.baseCurrency,
      },
      totals: {
        totalFunding,
        totalFundingIn,
        totalFundingOut,
        totalSpent,
        totalReimbursed,
        netTripCost: totalSpent - totalReimbursed,
      },
      highlights: {
        flights,
        accommodations,
        attractions,
      },
      highlightTransactions,
      dailySeries: dailySeriesRows.map((row) => ({
        date: row.date,
        spending: Number(row.spending || 0),
        reimbursement: Number(row.reimbursement || 0),
        net: Number(row.spending || 0) - Number(row.reimbursement || 0),
      })),
      categoryBreakdown: categoryRows.map((row) => ({
        category: row.id
          ? {
              id: row.id,
              name: row.name || "Uncategorized",
              color: row.color || "#94a3b8",
            }
          : null,
        totalOut: Number(row.totalOut || 0),
      })),
      recentEntries: recentRows.map((row) => ({
        id: row.id,
        type: row.type,
        date: row.date,
        label: row.label,
        description: row.description,
        localCurrency: row.localCurrency,
        localAmount: Number(row.localAmount || 0),
        baseAmount: Number(row.baseAmount || 0),
        walletName: row.walletName,
        category: {
          name: row.categoryName || "Uncategorized",
          color: row.categoryColor || "#94a3b8",
        },
      })),
    };
  }
}
