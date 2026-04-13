ALTER TABLE "trip_fundings"
ADD COLUMN "base_amount" DECIMAL(14, 4);

UPDATE "trip_fundings" tf
SET "base_amount" = COALESCE(
  CASE
    WHEN UPPER(tf."source_currency") = UPPER(t."base_currency") THEN tf."source_amount"
    WHEN UPPER(tf."destination_currency") = UPPER(t."base_currency") THEN tf."destination_amount"
    ELSE tf."source_amount"
  END,
  tf."source_amount"
)
FROM "trips" t
WHERE t."id" = tf."trip_id"
  AND tf."base_amount" IS NULL;
