"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./Button";
import { ColorSelect } from "./ColorSelect";

interface NewAccountColorModalProps {
  isOpen: boolean;
  accountIdentifier: string;
  defaultColor: string;
  onConfirm: (color: string) => void;
  onCancel: () => void;
}

export function NewAccountColorModal({
  isOpen,
  accountIdentifier,
  defaultColor,
  onConfirm,
  onCancel,
}: NewAccountColorModalProps) {
  const [selectedColor, setSelectedColor] = useState(defaultColor);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-2 rounded-lg shadow-[var(--shadow-card-2)] w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-stroke dark:border-dark-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                New Account Detected
              </h2>
              <p className="text-sm text-dark-5 dark:text-dark-6 mt-0.5">
                Choose a color for this account
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Account Identifier Display */}
          <div className="flex items-center gap-3 p-4 bg-gray-2 dark:bg-dark-3 rounded-lg">
            <div
              className="h-8 w-8 rounded-full border-2 border-white/70 shrink-0"
              style={{ backgroundColor: selectedColor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-dark-5 dark:text-dark-6 uppercase tracking-wide">
                Account Identifier
              </p>
              <p className="text-sm font-semibold text-dark dark:text-white truncate mt-0.5">
                {accountIdentifier}
              </p>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-3">
              Select Color
            </label>
            <ColorSelect value={selectedColor} onChange={setSelectedColor} />
          </div>

          {/* Preview Text */}
          <p className="text-xs text-dark-5 dark:text-dark-6 text-center">
            This color will help you identify transactions from this account
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-stroke dark:border-dark-3 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onConfirm(selectedColor)}>
            Confirm Color
          </Button>
        </div>
      </div>
    </div>
  );
}
