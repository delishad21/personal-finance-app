"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "./Button";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

interface AddAccountIdentifierModalProps {
  isOpen: boolean;
  defaultIdentifier?: string;
  defaultColor?: string;
  onConfirm: (identifier: string, color: string) => void;
  onCancel: () => void;
}

export function AddAccountIdentifierModal({
  isOpen,
  defaultIdentifier = "",
  defaultColor = "#6366f1",
  onConfirm,
  onCancel,
}: AddAccountIdentifierModalProps) {
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [selectedColor, setSelectedColor] = useState(defaultColor);

  useEffect(() => {
    if (isOpen) {
      setIdentifier(defaultIdentifier);
      setSelectedColor(defaultColor);
    }
  }, [isOpen, defaultIdentifier, defaultColor]);

  if (!isOpen) return null;

  const isValid = identifier.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-2 rounded-lg shadow-[var(--shadow-card-2)] w-full max-w-md">
        <div className="p-6 border-b border-stroke dark:border-dark-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                Add Account Identifier
              </h2>
              <p className="text-sm text-dark-5 dark:text-dark-6 mt-0.5">
                Add an account identifier and choose its color
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">
              Account Identifier
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 272-11324-6 or WeChat 96317826"
              className="w-full px-3 py-2 text-sm rounded-lg border border-stroke dark:border-dark-3 bg-white dark:bg-dark-2 text-dark dark:text-white outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

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
        </div>

        <div className="p-6 border-t border-stroke dark:border-dark-3 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(identifier.trim(), selectedColor)}
            disabled={!isValid}
          >
            Save Account
          </Button>
        </div>
      </div>
    </div>
  );
}
