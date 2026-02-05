"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { TextInput } from "@/components/ui/TextInput";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { AccountIdentifierSelect } from "@/components/ui/AccountIdentifierSelect";

interface Transaction {
  id: string;
  date: string;
  description: string;
  label?: string;
  amountIn: number | null;
  amountOut: number | null;
  balance: number | null;
  accountIdentifier?: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  metadata?: Record<string, any>;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface AccountIdentifier {
  id: string;
  accountIdentifier: string;
  color: string;
}

interface EditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction;
  categories: Category[];
  accountIdentifiers: AccountIdentifier[];
  onClose: () => void;
  onSave: (transaction: Transaction) => Promise<void>;
  onAddCategory: () => void;
  onAddAccountIdentifier: () => void;
}

export function EditTransactionModal({
  isOpen,
  transaction,
  categories,
  accountIdentifiers,
  onClose,
  onSave,
  onAddCategory,
  onAddAccountIdentifier,
}: EditTransactionModalProps) {
  // Helper to format date from ISO timestamp to YYYY-MM-DD
  const formatDateForPicker = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    ...transaction,
    date: formatDateForPicker(transaction.date),
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      ...transaction,
      date: formatDateForPicker(transaction.date),
    });
  }, [transaction]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Failed to save transaction:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAmountChange = (field: "amountIn" | "amountOut", value: string) => {
    const numValue = value ? parseFloat(value) : null;
    
    // When setting one amount, clear the other
    if (field === "amountIn") {
      setFormData({
        ...formData,
        amountIn: numValue,
        amountOut: null,
      });
    } else {
      setFormData({
        ...formData,
        amountIn: null,
        amountOut: numValue,
      });
    }
  };

  // Extract source from metadata
  const source = formData.metadata?.source || formData.metadata?.parserId;

  // Get additional metadata fields (exclude source, parserId, and common fields)
  const additionalMetadata = formData.metadata
    ? Object.entries(formData.metadata).filter(
        ([key]) =>
          !["source", "parserId", "bank", "transactionType"].includes(key),
      )
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-dark-2 rounded-lg shadow-card-2 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-dark-2 border-b border-stroke dark:border-dark-3 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-dark dark:text-white">
            Edit Transaction
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-dark-5 hover:text-dark dark:text-dark-6 dark:hover:text-white hover:bg-gray-2 dark:hover:bg-dark-3 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">
              Date
            </label>
            <DatePicker
              value={formData.date}
              onChange={(date) => setFormData({ ...formData, date })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">
              Description
            </label>
            <TextInput
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Transaction description"
            />
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">
              Label (Optional)
            </label>
            <TextInput
              value={formData.label || ""}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value || undefined })
              }
              placeholder="Custom label"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">
              Category
            </label>
            <CategorySelect
              value={formData.category?.id}
              categories={categories}
              onChange={(categoryId) =>
                setFormData({
                  ...formData,
                  category: categories.find((c) => c.id === categoryId),
                })
              }
              onAddClick={onAddCategory}
              excludeReserved
            />
          </div>

          {/* Account Identifier */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">
              Account Identifier
            </label>
            <AccountIdentifierSelect
              value={formData.accountIdentifier || ""}
              accountIdentifiers={accountIdentifiers}
              onChange={(accountIdentifier) =>
                setFormData({
                  ...formData,
                  accountIdentifier: accountIdentifier || null,
                })
              }
              onAddClick={onAddAccountIdentifier}
            />
          </div>

          {/* Amount Type - Income or Expense */}
          <div className="grid grid-cols-2 gap-4">
            {/* Income */}
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-2">
                Income
              </label>
              <TextInput
                type="text"
                inputMode="decimal"
                value={formData.amountIn !== null ? formData.amountIn.toFixed(2) : ""}
                onChange={(e) => handleAmountChange("amountIn", e.target.value)}
                placeholder="0.00"
                disabled={formData.amountOut !== null}
              />
            </div>

            {/* Expense */}
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-2">
                Expense
              </label>
              <TextInput
                type="text"
                inputMode="decimal"
                value={formData.amountOut !== null ? formData.amountOut.toFixed(2) : ""}
                onChange={(e) => handleAmountChange("amountOut", e.target.value)}
                placeholder="0.00"
                disabled={formData.amountIn !== null}
              />
            </div>
          </div>

          {/* Balance */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">
              Balance
            </label>
            <TextInput
              type="text"
              inputMode="decimal"
              value={formData.balance !== null ? formData.balance.toFixed(2) : ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  balance: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              placeholder="0.00"
            />
          </div>

          {/* Source (Read-only) */}
          {source && (
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-2">
                Source
              </label>
              <div className="px-4 py-3 bg-gray-2 dark:bg-dark-3 rounded-lg text-sm text-dark dark:text-white">
                {source}
              </div>
            </div>
          )}

          {/* Additional Metadata (Read-only) */}
          {additionalMetadata.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-2">
                Additional Details
              </label>
              <div className="px-4 py-3 bg-gray-2 dark:bg-dark-3 rounded-lg">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {additionalMetadata.map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-dark-5 dark:text-dark-6">
                        {key.replace(/([A-Z])/g, " $1").trim()}:
                      </dt>
                      <dd className="text-dark dark:text-white font-medium truncate">
                        {String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-dark-2 border-t border-stroke dark:border-dark-3 px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || !formData.description.trim()}
          >
            {isSaving ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
