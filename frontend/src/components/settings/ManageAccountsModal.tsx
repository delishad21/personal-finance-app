"use client";

import { useState } from "react";
import { WalletCards, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { ColorSelect } from "@/components/ui/ColorSelect";
import type { AccountIdentifier } from "@/app/actions/accountNumbers";

interface ManageAccountsModalProps {
  isOpen: boolean;
  accounts: AccountIdentifier[];
  newAccount: { identifier: string; color: string };
  onClose: () => void;
  onNewAccountChange: (next: { identifier: string; color: string }) => void;
  onAddAccount: () => void | Promise<void>;
  onAccountIdentifierChange: (id: string, identifier: string) => void;
  onAccountColorChange: (id: string, color: string) => void;
  onDeleteAccount: (id: string) => void;
  onSaveAll: () => void | Promise<void>;
}

export function ManageAccountsModal({
  isOpen,
  accounts,
  newAccount,
  onClose,
  onNewAccountChange,
  onAddAccount,
  onAccountIdentifierChange,
  onAccountColorChange,
  onDeleteAccount,
  onSaveAll,
}: ManageAccountsModalProps) {
  if (!isOpen) return null;
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-2 rounded-lg shadow-[var(--shadow-card-2)] w-full max-w-3xl">
        <div className="p-6 border-b border-stroke dark:border-dark-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-light-5 dark:bg-green-dark/40 text-green flex items-center justify-center">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                Manage Accounts
              </h2>
              <p className="text-sm text-dark-5 dark:text-dark-6 mt-0.5">
                Update identifiers and colors for each account.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {showAddForm ? (
            <div className="rounded-lg border border-stroke dark:border-dark-3 p-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                    New account identifier
                  </label>
                  <div className="flex items-center gap-3">
                    <ColorSelect
                      value={newAccount.color}
                      onChange={(color) =>
                        onNewAccountChange({ ...newAccount, color })
                      }
                    />
                    <TextInput
                      value={newAccount.identifier}
                      onChange={(e) =>
                        onNewAccountChange({
                          ...newAccount,
                          identifier: e.target.value,
                        })
                      }
                      placeholder="e.g., 21431251342"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={onAddAccount}
                  >
                    Add Account
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setShowAddForm(true)}
              >
                Add Account
              </Button>
            </div>
          )}

          <div className="space-y-3 max-h-[55vh] overflow-auto pr-2">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3">
                <ColorSelect
                  value={account.color}
                  onChange={(color) => onAccountColorChange(account.id, color)}
                />
                <div className="flex-1 min-w-[200px]">
                  <TextInput
                    value={account.accountIdentifier}
                    onChange={(e) =>
                      onAccountIdentifierChange(account.id, e.target.value)
                    }
                    className="w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteAccount(account.id)}
                  className="h-9 w-9 rounded-lg border border-stroke dark:border-dark-3 text-red hover:border-red hover:text-red-light transition-colors flex items-center justify-center"
                  title="Delete account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="text-sm text-dark-5 dark:text-dark-6">
                No account identifiers yet.
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-stroke dark:border-dark-3 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={onSaveAll}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
