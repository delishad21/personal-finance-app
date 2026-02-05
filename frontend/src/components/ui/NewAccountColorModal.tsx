"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./Button";

interface NewAccountColorModalProps {
  isOpen: boolean;
  accountIdentifier: string;
  defaultColor: string;
  onConfirm: (color: string) => void;
  onCancel: () => void;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

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
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                    selectedColor === color
                      ? "border-dark dark:border-white scale-110 shadow-lg"
                      : "border-transparent hover:border-stroke dark:hover:border-dark-3"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
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
