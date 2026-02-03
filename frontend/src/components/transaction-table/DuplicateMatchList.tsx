import { DuplicateMatch } from "./types";

interface DuplicateMatchListProps {
  matches: DuplicateMatch[];
  colSpan: number;
}

export function DuplicateMatchList({
  matches,
  colSpan,
}: DuplicateMatchListProps) {
  return (
    <tr className="bg-orange-100 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-900">
      <td colSpan={colSpan} className="py-2 px-4">
        <div className="pl-8">
          <div className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-2">
            ⚠️ Potential Duplicates Found
          </div>
          <div className="text-xs text-orange-800 dark:text-orange-200 mb-2">
            This transaction may already exist. Review the matches below:
          </div>
          <div className="space-y-2">
            {matches.map((match, matchIndex) => (
              <div
                key={matchIndex}
                className="p-2 bg-white dark:bg-dark-2 rounded border border-orange-200 dark:border-orange-800"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="text-sm text-dark dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Match {(match.matchScore * 100).toFixed(0)}%:
                        </span>
                        <span>
                          {new Date(
                            match.transaction.date,
                          ).toLocaleDateString()}
                        </span>
                        <span className="text-dark-5">•</span>
                        <span className="truncate">
                          {match.transaction.description}
                        </span>
                        <span className="text-dark-5">•</span>
                        <span className="font-mono">
                          {match.transaction.amountIn
                            ? `+${match.transaction.amountIn.toFixed(2)}`
                            : match.transaction.amountOut
                              ? `-${match.transaction.amountOut.toFixed(2)}`
                              : "-"}
                        </span>
                        {match.transaction.category && (
                          <>
                            <span className="text-dark-5">•</span>
                            <span
                              className="px-2 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: `${match.transaction.category.color}20`,
                                color: match.transaction.category.color,
                              }}
                            >
                              {match.transaction.category.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {match.matchReasons.map((reason, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}
