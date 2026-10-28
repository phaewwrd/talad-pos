import { Skeleton } from "@/components/ui/skeleton";

export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-20 shrink-0 bg-sidebar md:block" />
      <div className="flex flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b px-4 md:px-6">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="ml-auto h-9 w-24 rounded-full" />
        </div>
        <div className="grid gap-4 p-4 md:p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
