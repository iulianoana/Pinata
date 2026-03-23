import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gradient-to-r from-border via-accent-light to-border bg-[length:600px_100%] animate-shimmer",
        className
      )}
      {...props} />
  );
}

export { Skeleton }
