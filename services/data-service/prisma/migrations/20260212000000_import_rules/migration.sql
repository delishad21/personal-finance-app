CREATE TABLE "import_rules" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parser_id" TEXT,
  "match_type" TEXT NOT NULL DEFAULT 'description_contains',
  "match_value" TEXT,
  "case_sensitive" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "set_label" TEXT,
  "set_category_name" TEXT,
  "mark_internal" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "import_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_rules_user_id_name_key" ON "import_rules"("user_id", "name");
CREATE INDEX "import_rules_user_id_enabled_parser_id_idx" ON "import_rules"("user_id", "enabled", "parser_id");
CREATE INDEX "import_rules_user_id_sort_order_created_at_idx" ON "import_rules"("user_id", "sort_order", "created_at");

ALTER TABLE "import_rules"
ADD CONSTRAINT "import_rules_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

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
