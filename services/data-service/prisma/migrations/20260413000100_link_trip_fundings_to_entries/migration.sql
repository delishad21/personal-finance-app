ALTER TABLE trip_fundings
ADD COLUMN IF NOT EXISTS entry_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS trip_fundings_entry_id_key
ON trip_fundings(entry_id)
WHERE entry_id IS NOT NULL;

ALTER TABLE trip_fundings
ADD CONSTRAINT trip_fundings_entry_id_fkey
FOREIGN KEY (entry_id) REFERENCES trip_entries(id)
ON DELETE SET NULL;

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
SELECT
  'funding_entry_' || tf.id AS id,
  tf.trip_id,
  tf.wallet_id,
  CASE
    WHEN tf.bank_transaction_id IS NOT NULL THEN 'funding_in_bank'
    WHEN tf.source_type = 'imported_topup' THEN 'funding_in_imported_topup'
    WHEN tf.source_type = 'opening_balance' THEN 'funding_in_opening_balance'
    WHEN tf.source_type = 'wallet_conversion' THEN 'funding_in_wallet_conversion'
    WHEN tf.source_type = 'from_trip_outgoing' THEN 'funding_in_trip'
    ELSE 'funding_in_manual'
  END,
  tf.bank_transaction_id,
  'funding_in',
  COALESCE(
    NULLIF(tf.metadata->>'originalDate', '')::timestamptz,
    NULLIF(tf.metadata->>'basisTransactionDate', '')::timestamptz,
    bt.date,
    tf.created_at
  ),
  COALESCE(
    NULLIF(tf.metadata->>'originalDescription', ''),
    bt.description,
    CASE
      WHEN tf.source_type = 'opening_balance' THEN 'Opening balance'
      WHEN tf.source_type = 'wallet_conversion' THEN 'Wallet conversion'
      WHEN tf.source_type = 'from_trip_outgoing' THEN 'Funding imported from another trip'
      WHEN tf.source_type = 'imported_topup' THEN 'Imported top-up'
      ELSE 'Funding in'
    END
  ),
  CASE
    WHEN tf.source_type = 'opening_balance' THEN 'Opening Balance'
    WHEN tf.source_type = 'wallet_conversion' THEN 'Wallet Conversion In'
    WHEN tf.source_type = 'from_trip_outgoing' THEN 'Funding In from Trip'
    ELSE 'Funding In'
  END,
  tf.destination_currency,
  tf.destination_amount,
  CASE
    WHEN COALESCE(tf.destination_amount, 0) > 0 AND COALESCE(tf.base_amount, 0) > 0
    THEN ROUND((tf.base_amount / tf.destination_amount)::numeric, 6)
    ELSE 1
  END,
  COALESCE(tf.base_amount, tf.source_amount),
  NULL,
  NULL,
  NULL,
  NULL,
  jsonb_build_object(
    'fundingId', tf.id,
    'fundingDirection', 'in',
    'fundingSourceType', tf.source_type,
    'sourceType',
      CASE
        WHEN tf.bank_transaction_id IS NOT NULL THEN 'funding_in_bank'
        WHEN tf.source_type = 'imported_topup' THEN 'funding_in_imported_topup'
        WHEN tf.source_type = 'opening_balance' THEN 'funding_in_opening_balance'
        WHEN tf.source_type = 'wallet_conversion' THEN 'funding_in_wallet_conversion'
        WHEN tf.source_type = 'from_trip_outgoing' THEN 'funding_in_trip'
        ELSE 'funding_in_manual'
      END,
    'sourceCurrency', tf.source_currency,
    'sourceAmount', tf.source_amount,
    'destinationCurrency', tf.destination_currency,
    'destinationAmount', tf.destination_amount,
    'baseAmount', COALESCE(tf.base_amount, tf.source_amount),
    'fxRate',
      CASE
        WHEN COALESCE(tf.destination_amount, 0) > 0 AND COALESCE(tf.base_amount, 0) > 0
        THEN ROUND((tf.base_amount / tf.destination_amount)::numeric, 6)
        ELSE 1
      END,
    'feeAmount', tf.fee_amount,
    'feeCurrency', tf.fee_currency,
    'bankTransactionId', tf.bank_transaction_id,
    'bankTransactionDate', bt.date,
    'bankTransactionDescription', bt.description
  ) || COALESCE(tf.metadata::jsonb, '{}'::jsonb),
  tf.created_at
FROM trip_fundings tf
LEFT JOIN transactions bt ON bt.id = tf.bank_transaction_id
WHERE tf.entry_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM trip_entries te
    WHERE te.id = 'funding_entry_' || tf.id
  );

UPDATE trip_fundings tf
SET entry_id = 'funding_entry_' || tf.id
WHERE tf.entry_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM trip_entries te
    WHERE te.id = 'funding_entry_' || tf.id
  );
