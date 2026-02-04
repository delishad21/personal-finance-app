"use client";

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "./Button";

export type ModalType = "success" | "error" | "warning" | "info";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: ModalType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

const modalStyles = {
  success: {
    icon: CheckCircle,
    iconColor: "text-green",
    bgColor: "bg-green-light-5 dark:bg-green-dark/20",
    borderColor: "border-green-light-3 dark:border-green-dark",
    lineColor: "bg-green",
    buttonVariant: "success" as const,
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-red",
    bgColor: "bg-red-light-5 dark:bg-red-dark/20",
    borderColor: "border-red-light-3 dark:border-red-dark",
    lineColor: "bg-red",
    buttonVariant: "danger" as const,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-orange",
    bgColor: "bg-orange-light-4 dark:bg-orange-dark-3/20",
    borderColor: "border-orange-light-2 dark:border-orange-dark-1",
    lineColor: "bg-orange",
    buttonVariant: "primary" as const,
  },
  info: {
    icon: Info,
    iconColor: "text-blue",
    bgColor: "bg-blue-light-4 dark:bg-blue-dark/20",
    borderColor: "border-blue-light-3 dark:border-blue-dark",
    lineColor: "bg-blue",
    buttonVariant: "primary" as const,
  },
};

export function Modal({
  isOpen,
  onClose,
  title,
  message,
  type,
  confirmText = "OK",
  cancelText,
  onConfirm,
}: ModalProps) {
  if (!isOpen) return null;

  const style = modalStyles[type];
  const Icon = style.icon;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md bg-white dark:bg-dark-2 rounded-lg shadow-xl border border-stroke dark:border-dark-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute left-0 top-0 h-full w-1 ${style.lineColor}`}
        />
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${style.iconColor}`} />
            <h3 className="text-lg font-semibold text-dark dark:text-white">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg hover:bg-gray-1 dark:hover:bg-dark-3 transition-colors"
          >
            <X className="h-5 w-5 text-dark-5 dark:text-dark-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-sm text-dark-5 dark:text-dark-6 leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            {cancelText || "Cancel"}
          </Button>
          <Button variant={style.buttonVariant} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
