"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./Button";
import { ColorSelect } from "./ColorSelect";

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, color: string) => void;
}

export function AddCategoryModal({
  isOpen,
  onClose,
  onAdd,
}: AddCategoryModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim(), color);
      setName("");
      setColor("#6366f1");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white dark:bg-dark-2 rounded-lg shadow-[var(--shadow-card-2)]">
        <div className="flex items-center justify-between border-b border-stroke dark:border-dark-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark dark:text-white">
                Add New Category
              </h3>
              <p className="text-sm text-dark-5 dark:text-dark-6">
                Create a new category with a custom color.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
              Category
            </label>
            <div className="flex items-center gap-3">
              <ColorSelect value={color} onChange={setColor} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Groceries, Transport"
                className="w-full px-3 py-2 border border-stroke dark:border-dark-3 rounded-lg bg-white dark:bg-dark-2 text-dark dark:text-white outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                  if (e.key === "Escape") onClose();
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stroke dark:border-dark-3 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
            Add Category
          </Button>
        </div>
      </div>
    </div>
  );
}
