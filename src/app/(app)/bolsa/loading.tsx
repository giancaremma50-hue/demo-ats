import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-10 w-64" />
      <div className="mt-7 grid gap-8 lg:grid-cols-[560px_1fr]">
        <Card className="rounded-md p-6">
          <Skeleton className="h-6 w-32" />
          <div className="mt-6 flex flex-col gap-5">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="mt-7 flex flex-col gap-5 border-t border-border pt-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-[42px] w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
        <Skeleton className="h-[340px] w-full" />
      </div>
    </div>
  );
}
