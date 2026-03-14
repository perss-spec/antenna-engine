import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full h-10 rounded-lg border border-border bg-base px-3.5 text-sm text-text transition-[border-color,box-shadow] duration-150 placeholder:text-text-dim/50 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none file:border-0 file:bg-transparent file:text-sm file:font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
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
