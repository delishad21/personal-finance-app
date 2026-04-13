-- Create trip reimbursement allocations to support cross-currency reimbursement linking.
CREATE TABLE "trip_reimbursement_allocations" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "reimbursement_entry_id" TEXT NOT NULL,
    "reimbursed_entry_id" TEXT NOT NULL,
    "amount_base" DECIMAL(14,4) NOT NULL,
    "reimbursing_local_amount" DECIMAL(14,4) NOT NULL,
    "reimbursed_local_amount" DECIMAL(14,4) NOT NULL,
    "reimbursing_fx_rate" DECIMAL(14,6) NOT NULL,
    "reimbursed_fx_rate" DECIMAL(14,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trip_reimbursement_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trip_reimbursement_allocations_reimbursement_entry_id_reimbursed_entry_id_key"
ON "trip_reimbursement_allocations"("reimbursement_entry_id", "reimbursed_entry_id");

CREATE INDEX "trip_reimbursement_allocations_trip_id_idx"
ON "trip_reimbursement_allocations"("trip_id");

CREATE INDEX "trip_reimbursement_allocations_reimbursement_entry_id_idx"
ON "trip_reimbursement_allocations"("reimbursement_entry_id");

CREATE INDEX "trip_reimbursement_allocations_reimbursed_entry_id_idx"
ON "trip_reimbursement_allocations"("reimbursed_entry_id");

ALTER TABLE "trip_reimbursement_allocations"
ADD CONSTRAINT "trip_reimbursement_allocations_trip_id_fkey"
FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trip_reimbursement_allocations"
ADD CONSTRAINT "trip_reimbursement_allocations_reimbursement_entry_id_fkey"
FOREIGN KEY ("reimbursement_entry_id") REFERENCES "trip_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trip_reimbursement_allocations"
ADD CONSTRAINT "trip_reimbursement_allocations_reimbursed_entry_id_fkey"
FOREIGN KEY ("reimbursed_entry_id") REFERENCES "trip_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
