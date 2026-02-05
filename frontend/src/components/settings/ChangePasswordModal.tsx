"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";

interface ChangePasswordModalProps {
  isOpen: boolean;
  current: string;
  next: string;
  confirm: string;
  onChange: (nextState: { current: string; next: string; confirm: string }) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export function ChangePasswordModal({
  isOpen,
  current,
  next,
  confirm,
  onChange,
  onClose,
  onSave,
}: ChangePasswordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-2 rounded-lg shadow-[var(--shadow-card-2)] w-full max-w-lg">
        <div className="p-6 border-b border-stroke dark:border-dark-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-light-4 dark:bg-blue-dark/40 text-blue flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                Change Password
              </h2>
              <p className="text-sm text-dark-5 dark:text-dark-6 mt-0.5">
                Update your account password.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
              Current password
            </label>
            <TextInput
              type="password"
              value={current}
              onChange={(e) =>
                onChange({ current: e.target.value, next, confirm })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
              New password
            </label>
            <TextInput
              type="password"
              value={next}
              onChange={(e) =>
                onChange({ current, next: e.target.value, confirm })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
              Confirm new password
            </label>
            <TextInput
              type="password"
              value={confirm}
              onChange={(e) =>
                onChange({ current, next, confirm: e.target.value })
              }
            />
          </div>
        </div>

        <div className="p-6 border-t border-stroke dark:border-dark-3 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave}>
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
