import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const selectVariants = cva(
  "flex w-full border border-border bg-surface-hover/80 text-text transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 focus-visible:border-accent/30 focus-visible:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      size: {
        sm: "h-7 rounded px-2 py-1 text-xs",
        md: "h-8 rounded-md px-2.5 py-1 text-sm",
        lg: "h-9 rounded-lg px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, size, ...props }, ref) => (
    <select
      className={cn(selectVariants({ size }), className)}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = "Select"

export { Select, selectVariants }
