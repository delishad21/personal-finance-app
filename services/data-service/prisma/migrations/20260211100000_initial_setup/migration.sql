-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'COMMITTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "password" TEXT,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
    "default_timeframe" TEXT NOT NULL DEFAULT 'month',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_numbers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1976d2',
    "icon" TEXT NOT NULL DEFAULT 'category',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "parser_id" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "label" TEXT,
    "category_id" TEXT,
    "amount_in" DECIMAL(12,2),
    "amount_out" DECIMAL(12,2),
    "balance" DECIMAL(12,2),
    "account_number" TEXT,
    "source" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "metadata" JSONB,
    "linkage" JSONB,
    "import_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "base_currency" TEXT NOT NULL DEFAULT 'SGD',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_balance_buckets" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "cost_basis_base" DECIMAL(14,4) NOT NULL,
    "fx_rate" DECIMAL(14,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_balance_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_fundings" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "wallet_id" TEXT,
    "bank_transaction_id" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_currency" TEXT NOT NULL,
    "source_amount" DECIMAL(14,4) NOT NULL,
    "destination_currency" TEXT NOT NULL,
    "destination_amount" DECIMAL(14,4) NOT NULL,
    "fx_rate" DECIMAL(14,6),
    "fee_amount" DECIMAL(14,4),
    "fee_currency" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_fundings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_conversions" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "from_currency" TEXT NOT NULL,
    "from_amount" DECIMAL(14,4) NOT NULL,
    "to_currency" TEXT NOT NULL,
    "to_amount" DECIMAL(14,4) NOT NULL,
    "fx_rate" DECIMAL(14,6) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_entries" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "wallet_id" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'wallet',
    "source_transaction_id" TEXT,
    "type" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "label" TEXT,
    "local_currency" TEXT NOT NULL,
    "local_amount" DECIMAL(14,4) NOT NULL,
    "fx_rate" DECIMAL(14,6) NOT NULL,
    "base_amount" DECIMAL(14,4) NOT NULL,
    "fee_amount" DECIMAL(14,4),
    "fee_currency" TEXT,
    "category_id" TEXT,
    "linked_entry_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parser_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parser_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_numbers_user_id_account_number_key" ON "account_numbers"("user_id", "account_number");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_key" ON "categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "transactions_user_id_date_idx" ON "transactions"("user_id", "date");

-- CreateIndex
CREATE INDEX "transactions_user_id_category_id_idx" ON "transactions"("user_id", "category_id");

-- CreateIndex
CREATE INDEX "trips_user_id_start_date_idx" ON "trips"("user_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_trip_id_name_currency_key" ON "wallets"("trip_id", "name", "currency");

-- CreateIndex
CREATE INDEX "wallet_balance_buckets_wallet_id_currency_idx" ON "wallet_balance_buckets"("wallet_id", "currency");

-- CreateIndex
CREATE INDEX "trip_fundings_trip_id_idx" ON "trip_fundings"("trip_id");

-- CreateIndex
CREATE INDEX "trip_fundings_bank_transaction_id_idx" ON "trip_fundings"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "trip_conversions_trip_id_idx" ON "trip_conversions"("trip_id");

-- CreateIndex
CREATE INDEX "trip_entries_trip_id_idx" ON "trip_entries"("trip_id");

-- CreateIndex
CREATE INDEX "trip_entries_trip_id_type_idx" ON "trip_entries"("trip_id", "type");

-- CreateIndex
CREATE INDEX "trip_entries_linked_entry_id_idx" ON "trip_entries"("linked_entry_id");

-- CreateIndex
CREATE INDEX "trip_entries_source_type_idx" ON "trip_entries"("source_type");

-- CreateIndex
CREATE INDEX "trip_entries_source_transaction_id_idx" ON "trip_entries"("source_transaction_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_numbers" ADD CONSTRAINT "account_numbers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balance_buckets" ADD CONSTRAINT "wallet_balance_buckets_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_fundings" ADD CONSTRAINT "trip_fundings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_fundings" ADD CONSTRAINT "trip_fundings_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_fundings" ADD CONSTRAINT "trip_fundings_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_conversions" ADD CONSTRAINT "trip_conversions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_conversions" ADD CONSTRAINT "trip_conversions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_entries" ADD CONSTRAINT "trip_entries_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_entries" ADD CONSTRAINT "trip_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_entries" ADD CONSTRAINT "trip_entries_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_entries" ADD CONSTRAINT "trip_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_entries" ADD CONSTRAINT "trip_entries_linked_entry_id_fkey" FOREIGN KEY ("linked_entry_id") REFERENCES "trip_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

