import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full border border-border bg-surface-hover/80 text-text transition-colors duration-100 placeholder:text-text-dim/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 focus-visible:border-accent/30 focus-visible:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none file:border-0 file:bg-transparent file:text-sm file:font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  {
    variants: {
      size: {
        sm: "h-8 rounded px-2.5 py-1 text-xs",
        md: "h-9 rounded-md px-3 py-1.5 text-sm",
        lg: "h-10 rounded-lg px-3.5 py-2 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, ...props }, ref) => (
    <input
      type={type}
      className={cn(inputVariants({ size }), className)}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input, inputVariants }
