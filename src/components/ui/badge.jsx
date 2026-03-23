import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-accent-light text-accent",
        secondary:
          "border-transparent bg-accent-light text-accent",
        destructive:
          "border-transparent bg-error-light text-error",
        outline:
          "border-border text-text",
        quiz:
          "border-transparent bg-quiz-light text-quiz",
        "unit-quiz":
          "border-transparent bg-unit-quiz-light text-unit-quiz",
        amber:
          "border-transparent bg-amber-light text-amber-dark",
        success:
          "border-transparent bg-success-light text-success",
        muted:
          "border-border bg-transparent text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
