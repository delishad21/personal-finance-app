"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NumberInput } from "@/components/ui/NumberInput";

export interface ReimbursementAllocationRowModel {
  key: string;
  title: string;
  subtitle: string;
  reimbursableAmount: number;
  alreadyAllocated?: number;
  allocatedNow: number;
  maxAllowed: number;
  leftoverAfterAllocation: number;
  onSetAllocation: (value: number) => void;
  onSetPercent: (percent: number) => void;
  onSetFull: () => void;
  onSetHalf: () => void;
  onRemove: () => void;
}

interface AllocationEditorRowProps {
  item: ReimbursementAllocationRowModel;
  formatAmount: (amount: number) => string;
}

export function AllocationEditorRow({
  item,
  formatAmount,
}: AllocationEditorRowProps) {
  const percentage =
    item.reimbursableAmount > 0
      ? Number(((item.allocatedNow / item.reimbursableAmount) * 100).toFixed(2))
      : 0;

  return (
    <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-dark dark:text-white">
            {item.title}
          </p>
          <p className="text-xs text-dark-5 dark:text-dark-6">{item.subtitle}</p>
          {(item.alreadyAllocated || 0) > 0 ? (
            <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
              Already reimbursed: {formatAmount(item.alreadyAllocated || 0)}
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <div className="text-[11px] text-dark-5 dark:text-dark-6">Reimbursable</div>
          <div className="text-lg font-semibold text-green">
            {formatAmount(item.reimbursableAmount)}
          </div>
          <div className="mt-1 text-[11px] text-dark-5 dark:text-dark-6">Leftover</div>
          <div className="text-base font-semibold text-red">
            {formatAmount(item.leftoverAfterAllocation)}
          </div>
        </div>

        <button
          type="button"
          onClick={item.onRemove}
          className="rounded p-1 text-dark-5 transition-colors hover:bg-gray-1 hover:text-dark dark:text-dark-6 dark:hover:bg-dark-3 dark:hover:text-white"
          title="Remove selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-[1fr_120px_auto]">
        <NumberInput
          value={item.allocatedNow || ""}
          onChange={(event) => item.onSetAllocation(Number(event.target.value || 0))}
          step="0.01"
          min="0"
        />
        <NumberInput
          value={percentage || ""}
          onChange={(event) => item.onSetPercent(Number(event.target.value || 0))}
          step="0.01"
          min="0"
          max="100"
          placeholder="%"
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={item.onSetHalf}>
            1/2
          </Button>
          <Button type="button" variant="secondary" onClick={item.onSetFull}>
            Full
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-dark-5 dark:text-dark-6">
        Max allocatable now: {formatAmount(item.maxAllowed)}
      </p>
    </div>
  );
}
