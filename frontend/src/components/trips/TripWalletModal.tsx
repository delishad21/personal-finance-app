"use client";

import type { WalletSummary } from "@/app/actions/trips";
import { Button } from "@/components/ui/Button";
import { ColorSelect } from "@/components/ui/ColorSelect";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { Plus, Wallet } from "lucide-react";

interface TripWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletSummaries: WalletSummary[];
  walletForm: {
    name: string;
    currency: string;
    color: string;
  };
  setWalletForm: (
    updater: (
      prev: TripWalletModalProps["walletForm"],
    ) => TripWalletModalProps["walletForm"],
  ) => void;
  currencyOptions: { value: string; label: string }[];
  isBusy: boolean;
  onCreateWallet: () => void;
  formatCurrencyValue: (value: number) => string;
}

export function TripWalletModal({
  isOpen,
  onClose,
  walletSummaries,
  walletForm,
  setWalletForm,
  currencyOptions,
  isBusy,
  onCreateWallet,
  formatCurrencyValue,
}: TripWalletModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 shadow-card-2"
      >
        <div className="px-6 py-4 border-b border-stroke dark:border-dark-3">
          <h3 className="text-lg font-semibold text-dark dark:text-white">
            Manage Wallets
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {walletSummaries.map((wallet) => (
              <div
                key={wallet.id}
                className="rounded-lg border border-stroke dark:border-dark-3 px-3 py-2 bg-white dark:bg-dark-2"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: wallet.color || "#ffffff",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <Wallet className="h-4 w-4 shrink-0 text-dark-5 dark:text-dark-6" />
                    <div className="truncate text-sm font-medium text-dark dark:text-white">
                      {wallet.name}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-stroke px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dark-5 dark:border-dark-3 dark:text-dark-6">
                    {wallet.currency}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  {wallet.balances.length === 0 ? (
                    <span className="text-dark-5 dark:text-dark-6">No balance yet</span>
                  ) : (
                    wallet.balances.map((balance, index) => (
                      <span
                        key={`${wallet.id}:${balance.currency}:${index}`}
                        className={
                          balance.amount >= 0
                            ? "text-green"
                            : "text-red dark:text-red-light"
                        }
                      >
                        {formatCurrencyValue(balance.amount)} {balance.currency}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]">
            <TextInput
              value={walletForm.name}
              onChange={(e) =>
                setWalletForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Wallet name"
            />
            <Select
              value={walletForm.currency}
              onChange={(value) =>
                setWalletForm((prev) => ({ ...prev, currency: value }))
              }
              options={currencyOptions}
              placeholder="Wallet currency"
              className="w-full"
              buttonClassName="w-full"
              menuPlacement="up"
            />
            <ColorSelect
              value={walletForm.color}
              onChange={(color) =>
                setWalletForm((prev) => ({ ...prev, color }))
              }
            />
            <Button
              variant="secondary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={onCreateWallet}
              disabled={isBusy || !walletForm.name.trim() || !walletForm.currency}
            >
              Add
            </Button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-stroke dark:border-dark-3 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
