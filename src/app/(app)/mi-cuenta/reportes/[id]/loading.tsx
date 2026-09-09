import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl">
      <Skeleton className="h-4 w-24" />
      <Card className="mt-4 rounded-md p-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-4 h-20 w-full" />
      </Card>
    </div>
  );
}
