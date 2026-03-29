import { Skeleton } from './Skeleton';

export function PageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Title bar */}
      <Skeleton variant="text" className="h-7 w-48" />

      {/* KPI cards row */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <Skeleton variant="text" className="h-3 w-16" />
            <Skeleton variant="text" className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* List items */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <Skeleton variant="circular" className="w-10 h-10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
            <Skeleton variant="rectangular" className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
