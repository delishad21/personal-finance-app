interface DuplicateWarningBannerProps {
  duplicateCount: number;
  nonDuplicateCount: number;
}

export function DuplicateWarningBanner({
  duplicateCount,
  nonDuplicateCount,
}: DuplicateWarningBannerProps) {
  return (
    <div className="flex-shrink-0 mb-3 p-4 bg-orange-light-4 dark:bg-orange-dark-3/20 border border-orange-light-2 dark:border-orange-dark-1 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="h-5 w-5 text-orange-dark dark:text-orange-light"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-orange-dark-2 dark:text-orange-light-3 mb-1">
            Potential Duplicates Detected
          </h3>
          <p className="text-sm text-orange-dark-1 dark:text-orange-light-2">
            These transactions may already exist in your account. Review each
            one and select which ones you want to import. Your other{" "}
            {nonDuplicateCount} transaction
            {nonDuplicateCount !== 1 ? "s" : ""} will be imported automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
