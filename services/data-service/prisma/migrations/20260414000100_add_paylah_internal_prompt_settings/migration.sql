ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "paylah_internal_prompted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paylah_auto_internal" BOOLEAN NOT NULL DEFAULT false;
