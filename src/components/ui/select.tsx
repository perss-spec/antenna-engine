import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const selectVariants = cva(
  "flex w-full h-10 rounded-lg border border-border bg-base px-3.5 text-sm text-text transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      size: {
        sm: "h-8 rounded-md px-2.5 py-1 text-xs",
        md: "",
        lg: "h-12 rounded-lg px-4 py-2.5 text-base",
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
