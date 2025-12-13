import * as React from "react"

import { cn } from "@/components/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-lg shadow-sm transition-colors file:border-0 file:bg-transparent file:text-base file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-[1.5px] focus-visible:outline-none focus-visible:ring-primary-500 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-base",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
