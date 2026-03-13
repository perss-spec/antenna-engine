import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-hover shadow-md shadow-accent/20 hover:shadow-accent/30",
        destructive: "bg-error text-white hover:bg-error/90 shadow-md shadow-error/20",
        outline: "border border-border bg-transparent hover:bg-surface-hover hover:border-border-hover text-text",
        ghost: "hover:bg-surface-hover text-text",
      },
      size: {
        sm: "h-8 rounded px-3 text-xs",
        md: "h-9 rounded-md px-4 text-sm",
        lg: "h-10 rounded-lg px-6 text-sm",
      },
      radius: {
        sm: "rounded",
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, radius }), className)} {...props} />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
