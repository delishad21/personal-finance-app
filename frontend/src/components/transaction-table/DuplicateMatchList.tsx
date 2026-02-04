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
    <tr className="bg-orange-light-3 dark:bg-orange-dark-3/30 border-b border-orange-light-2 dark:border-orange-dark-1">
      <td colSpan={colSpan} className="py-2 px-4">
        <div className="pl-8">
          <div className="text-sm font-semibold text-orange-dark-2 dark:text-orange-light-3 mb-2">
            ⚠️ Potential Duplicates Found
          </div>
          <div className="text-xs text-orange-dark-1 dark:text-orange-light-2 mb-2">
            This transaction may already exist. Review the matches below:
          </div>
          <div className="space-y-2">
            {matches.map((match, matchIndex) => (
              <div
                key={matchIndex}
                className="p-2 bg-white dark:bg-dark-2 rounded border border-orange-light-2 dark:border-orange-dark-1"
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
                            ? `+${Number(match.transaction.amountIn).toFixed(2)}`
                            : match.transaction.amountOut
                              ? `-${Number(match.transaction.amountOut).toFixed(2)}`
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
                          className="text-xs px-2 py-0.5 bg-orange-light-3 dark:bg-orange-dark-1/30 text-orange-dark dark:text-orange-light-1 rounded"
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
