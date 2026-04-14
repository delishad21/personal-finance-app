ALTER TABLE "user_settings"
  ADD COLUMN "auto_label_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "auto_label_threshold" DECIMAL(4,2) NOT NULL DEFAULT 0.5;
