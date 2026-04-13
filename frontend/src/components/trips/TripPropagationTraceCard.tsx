"use client";

import { useMemo, useState } from "react";
import type { TripPropagationTrace } from "@/app/actions/trips";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChevronDown, ChevronUp, Route } from "lucide-react";

interface TripPropagationTraceCardProps {
  trace: TripPropagationTrace | TripPropagationTrace[] | null;
  className?: string;
}

const formatWalletRef = (wallet: { tripId: string; walletId: string }) =>
  `${wallet.tripId.slice(0, 8)}... / ${wallet.walletId.slice(0, 8)}...`;

export function TripPropagationTraceCard({
  trace,
  className,
}: TripPropagationTraceCardProps) {
  const traces = useMemo(() => {
    if (!trace) return [];
    return Array.isArray(trace) ? trace : [trace];
  }, [trace]);
  const [expanded, setExpanded] = useState(false);

  if (traces.length === 0) return null;

  const totalWalletRecalculations = traces.reduce(
    (sum, item) => sum + (item.totalWalletRecalculations || 0),
    0,
  );
  const totalFundingRowsUpdated = traces.reduce(
    (sum, item) => sum + (item.totalFundingRowsUpdated || 0),
    0,
  );
  const totalSteps = traces.reduce((sum, item) => sum + (item.steps?.length || 0), 0);
  const hasTruncated = traces.some((item) => item.truncated);

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
              <Route className="h-4 w-4 text-primary" />
              Propagation Trace
            </div>
            <div className="mt-1 text-xs text-dark-5 dark:text-dark-6">
              Wallet recalculations: {totalWalletRecalculations} • Linked funding updates:{" "}
              {totalFundingRowsUpdated}
              {hasTruncated ? " • Trace truncated" : ""}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            leftIcon={expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          >
            {expanded ? "Hide Steps" : "Show Steps"}
          </Button>
        </div>

        {expanded && (
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {traces.map((item, traceIndex) => (
              <div
                key={`${item.startedAt}:${traceIndex}`}
                className="rounded-lg border border-stroke p-3 dark:border-dark-3"
              >
                <div className="text-xs text-dark-5 dark:text-dark-6">
                  Run {traceIndex + 1} • {new Date(item.startedAt).toLocaleString()} • Steps:{" "}
                  {item.steps.length}
                </div>
                <div className="mt-2 space-y-2">
                  {item.steps.map((step, index) => (
                    <div
                      key={`${traceIndex}:${index}:${step.phase}`}
                      className="rounded-md bg-gray-1/60 px-2.5 py-2 text-xs dark:bg-dark-3/60"
                    >
                      <div className="font-medium text-dark dark:text-white">
                        {step.phase === "recalculate_wallet"
                          ? "Recalculate Wallet"
                          : "Sync Linked Fundings"}
                      </div>
                      <div className="mt-1 text-dark-5 dark:text-dark-6">
                        Trip/Wallet: {formatWalletRef(step)}
                      </div>
                      {typeof step.updatedEntryCount === "number" && (
                        <div className="text-dark-5 dark:text-dark-6">
                          Updated entries: {step.updatedEntryCount}
                        </div>
                      )}
                      {typeof step.updatedFundingCount === "number" && (
                        <div className="text-dark-5 dark:text-dark-6">
                          Updated linked fundings: {step.updatedFundingCount}
                        </div>
                      )}
                      {step.queuedWallets && step.queuedWallets.length > 0 && (
                        <div className="text-dark-5 dark:text-dark-6">
                          Queued: {step.queuedWallets.map(formatWalletRef).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-xs text-dark-5 dark:text-dark-6">Total step rows: {totalSteps}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

