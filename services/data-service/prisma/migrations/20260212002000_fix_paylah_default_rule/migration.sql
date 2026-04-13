-- Remove incorrect default PayLah rules
DELETE FROM "import_rules"
WHERE "name" IN (
  'PayLah statement transactions are Internal',
  'PayLah top-up transactions are Internal'
);

-- Insert corrected default PayLah rule for all users who don't already have it
INSERT INTO "import_rules" (
  "id", "user_id", "name", "parser_id", "match_type", "match_value", "case_sensitive", "enabled", "mark_internal", "sort_order", "created_at", "updated_at"
)
SELECT
  ('rule_' || substr(md5(random()::text || clock_timestamp()::text || u."id"), 1, 24)),
  u."id",
  'PayLah top-up from account is Internal',
  'dbs_paylah_statement',
  'description_contains',
  'TOP UP WALLET FROM MY ACCOUNT',
  false,
  true,
  true,
  10,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1
  FROM "import_rules" r
  WHERE r."user_id" = u."id"
    AND r."name" = 'PayLah top-up from account is Internal'
);
