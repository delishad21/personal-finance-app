"use client";

import type { Category } from "@/app/actions/categories";
import type { Trip, Wallet } from "@/app/actions/trips";
import { Button } from "@/components/ui/Button";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";

interface TripManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBusy: boolean;
  onSubmit: () => void;
  onAddCategoryClick: () => void;
  localCategories: Category[];
  wallets: Wallet[];
  currencyOptions: { value: string; label: string }[];
  baseCurrency: string;
  form: {
    walletId: string;
    type: "spending" | "reimbursement" | "funding_out";
    date: string;
    description: string;
    label: string;
    categoryId: string;
    localCurrency: string;
    localAmount: string;
    baseAmount: string;
    fxRate: string;
    fundingOutDestinationType: "bank" | "trip" | "external";
    fundingOutDestinationTripId: string;
    fundingOutDestinationCurrency: string;
    fundingOutDestinationAmount: string;
    fundingOutFxRate: string;
    fundingOutFeeAmount: string;
    fundingOutFeeCurrency: string;
    fundingOutInputMode: "amount" | "fxRate";
  };
  setForm: (
    updater: (
      prev: TripManualEntryModalProps["form"],
    ) => TripManualEntryModalProps["form"],
  ) => void;
  resetForm: () => void;
  availableTrips: Pick<Trip, "id" | "name">[];
}

export function TripManualEntryModal({
  isOpen,
  onClose,
  isBusy,
  onSubmit,
  onAddCategoryClick,
  localCategories,
  wallets,
  currencyOptions,
  baseCurrency,
  form,
  setForm,
  resetForm,
  availableTrips,
}: TripManualEntryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-3xl bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 shadow-card-2 max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-stroke dark:border-dark-3">
          <h3 className="text-lg font-semibold text-dark dark:text-white">
            Add Manual Trip Transaction
          </h3>
          <p className="text-sm text-dark-5 dark:text-dark-6">
            Create a trip transaction directly, and choose whether it should
            deduct from a wallet.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Entry type
              </label>
              <Select
                value={form.type}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    type: value as "spending" | "reimbursement" | "funding_out",
                    categoryId: value === "reimbursement" ? "" : prev.categoryId,
                  }))
                }
                className="w-full"
                buttonClassName="w-full"
                menuPlacement="down"
                options={[
                  { value: "spending", label: "Spending" },
                  { value: "reimbursement", label: "Reimbursement" },
                  { value: "funding_out", label: "Funding Out" },
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Wallet
              </label>
              <Select
                value={form.walletId}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    walletId: value,
                  }))
                }
                className="w-full"
                buttonClassName="w-full"
                menuPlacement="down"
                options={[
                  { value: "__none__", label: "No wallet" },
                  ...wallets.map((wallet) => ({
                    value: wallet.id,
                    label: `${wallet.name} (${wallet.currency})`,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Date
              </label>
              <div className="h-11 rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2">
                <DatePicker
                  value={form.date}
                  onChange={(value: string) =>
                    setForm((prev) => ({ ...prev, date: value }))
                  }
                  className="h-full"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Label (optional)
              </label>
              <TextInput
                value={form.label}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    label: e.target.value,
                  }))
                }
                placeholder="Optional short label"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
              Description
            </label>
            <TextInput
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Transaction description"
            />
          </div>

          {form.type === "spending" && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Trip category
              </label>
              <div className="h-11 rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2">
                <CategorySelect
                  value={form.categoryId}
                  categories={localCategories}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      categoryId: value,
                    }))
                  }
                  onAddClick={onAddCategoryClick}
                  emptyLabel="Select category"
                  triggerProps={{
                    className:
                      "h-full rounded-lg border-0 bg-transparent px-3 py-0 hover:bg-transparent dark:hover:bg-transparent",
                  }}
                />
              </div>
            </div>
          )}

          {form.type === "funding_out" && (
            <div className="rounded-lg border border-stroke dark:border-dark-3 p-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    Destination
                  </label>
                  <Select
                    value={form.fundingOutDestinationType}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutDestinationType: value as
                          | "bank"
                          | "trip"
                          | "external",
                        fundingOutDestinationCurrency:
                          value === "bank"
                            ? baseCurrency
                            : prev.fundingOutDestinationCurrency,
                      }))
                    }
                    className="w-full"
                    buttonClassName="w-full"
                    menuPlacement="up"
                    options={[
                      { value: "bank", label: "Back to Bank" },
                      { value: "trip", label: "Another Trip" },
                      { value: "external", label: "External" },
                    ]}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    Destination trip
                  </label>
                  <Select
                    value={form.fundingOutDestinationTripId}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutDestinationTripId: value,
                      }))
                    }
                    className="w-full"
                    buttonClassName="w-full"
                    menuPlacement="up"
                    options={[
                      ...(form.fundingOutDestinationType === "trip"
                        ? [{ value: "", label: "Select trip" }]
                        : [{ value: "", label: "Destination is not a trip" }]),
                      ...(form.fundingOutDestinationType === "trip"
                        ? availableTrips.map((item) => ({
                            value: item.id,
                            label: item.name,
                          }))
                        : []),
                    ]}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    Destination currency
                  </label>
                  <Select
                    value={form.fundingOutDestinationCurrency}
                    onChange={(value) =>
                      form.fundingOutDestinationType === "bank"
                        ? undefined
                        : setForm((prev) => ({
                            ...prev,
                            fundingOutDestinationCurrency: value,
                          }))
                    }
                    options={
                      form.fundingOutDestinationType === "bank"
                        ? [{ value: baseCurrency, label: baseCurrency }]
                        : currencyOptions
                    }
                    className="w-full"
                    buttonClassName={`w-full ${
                      form.fundingOutDestinationType === "bank"
                        ? "pointer-events-none opacity-70"
                        : ""
                    }`}
                    menuPlacement="up"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-dark dark:text-white">
                  <Checkbox
                    checked={form.fundingOutInputMode === "amount"}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutInputMode: "amount",
                      }))
                    }
                  />
                  Use destination amount
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-dark dark:text-white">
                  <Checkbox
                    checked={form.fundingOutInputMode === "fxRate"}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutInputMode: "fxRate",
                      }))
                    }
                  />
                  Use FX rate
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    Destination amount
                  </label>
                  <NumberInput
                    value={form.fundingOutDestinationAmount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutDestinationAmount: e.target.value,
                      }))
                    }
                    disabled={form.fundingOutInputMode !== "amount"}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    FX rate
                  </label>
                  <NumberInput
                    value={form.fundingOutFxRate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutFxRate: e.target.value,
                      }))
                    }
                    disabled={form.fundingOutInputMode !== "fxRate"}
                    placeholder="1.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    Fee amount
                  </label>
                  <NumberInput
                    value={form.fundingOutFeeAmount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutFeeAmount: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    Fee currency
                  </label>
                  <Select
                    value={form.fundingOutFeeCurrency}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        fundingOutFeeCurrency: value,
                      }))
                    }
                    options={currencyOptions}
                    className="w-full"
                    buttonClassName="w-full"
                    menuPlacement="up"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Spent currency
              </label>
              <Select
                value={form.localCurrency}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    localCurrency: value,
                  }))
                }
                options={currencyOptions}
                className="w-full"
                buttonClassName="w-full"
                menuPlacement="up"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Spent amount
              </label>
              <NumberInput
                value={form.localAmount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    localAmount: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Base amount ({baseCurrency})
              </label>
              <NumberInput
                value={form.baseAmount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    baseAmount: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-1">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                FX rate (optional)
              </label>
              <NumberInput
                value={form.fxRate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    fxRate: e.target.value,
                  }))
                }
                placeholder="Auto if empty"
              />
            </div>
          </div>
          <p className="text-xs text-dark-5 dark:text-dark-6">
            Fees are recorded as separate transactions. Add a dedicated fee entry
            if needed.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-stroke dark:border-dark-3 flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={isBusy}>
            {isBusy ? "Adding..." : "Add Transaction"}
          </Button>
        </div>
      </div>
    </div>
  );
}
