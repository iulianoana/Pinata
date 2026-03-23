import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function SkeletonCard({ variant = "default" }) {
  return (
    <div className={cn(
      "animate-skeleton-glow bg-white rounded-2xl p-4",
      variant === "progress" ? "border-[2.5px] border-accent-light" : "border border-transparent"
    )}>
      {variant === "progress" && (
        <div className="flex justify-end mb-2">
          <Skeleton className="w-20 h-[22px] rounded-[20px]" />
        </div>
      )}
      <Skeleton className="w-[70%] h-[18px] mb-2" />
      <Skeleton className={cn("w-[45%] h-[13px]", variant === "progress" ? "mb-3.5" : "mb-1")} />
      {variant === "progress" && (
        <>
          <div className="flex gap-[3px] p-[3px] bg-border rounded-[10px] h-3.5 mb-3.5">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="flex-1 rounded-[7px]" />
            ))}
          </div>
          <Skeleton className="w-full h-11 rounded-[14px]" />
        </>
      )}
    </div>
  );
}
