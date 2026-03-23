import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-extrabold font-nunito transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white hover:brightness-110",
        destructive:
          "bg-error text-white hover:brightness-110",
        outline:
          "border-2 border-border bg-transparent text-text hover:bg-accent-light",
        secondary:
          "bg-accent-light text-accent hover:brightness-95",
        ghost:
          "bg-transparent hover:bg-accent-light",
        quiz:
          "bg-quiz text-white hover:bg-quiz-hover",
        "unit-quiz":
          "bg-unit-quiz text-white hover:brightness-110",
        link:
          "text-accent underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        default: "h-12 px-5 py-3 text-[15px]",
        sm: "h-9 px-3.5 py-2 text-[13px] rounded-xl",
        lg: "h-[52px] px-6 py-3 text-base",
        xs: "h-7 px-2.5 py-1 text-[11px] rounded-lg font-bold",
        icon: "h-9 w-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
