"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { ColorSelect } from "./ColorSelect";

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
            <div className="flex items-center gap-3">
              <ColorSelect value={selectedColor} onChange={setSelectedColor} />
              <TextInput
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 6420912424"
                className="w-full flex-1"
              />
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
