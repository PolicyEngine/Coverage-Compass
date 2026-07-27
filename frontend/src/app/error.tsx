'use client';

// Route-level error boundary: catches render errors so users get a retry
// button instead of a blank page.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-4">
          The page hit an unexpected error. Your household details may need to be re-entered.
        </p>
        {error.digest && (
          <p className="text-[11px] text-gray-400 mb-4">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-[#319795] text-white text-sm font-medium hover:bg-[#285E61] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
