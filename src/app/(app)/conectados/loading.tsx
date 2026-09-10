import { Skeleton } from "@/components/ui/skeleton";

export default function ConectadosLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 pt-24 text-center">
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
