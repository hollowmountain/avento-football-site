import { Skeleton } from '@/shared/ui/skeleton';

export default function GameLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-5 w-48" />
      </div>
      <Skeleton className="h-52 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-md" />
        <Skeleton className="h-11 w-32 rounded-md" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
