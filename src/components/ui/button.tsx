import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white hover:bg-accent/90 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30",
        secondary:
          "bg-elevated text-text hover:bg-overlay border border-border/50",
        destructive:
          "bg-error text-white hover:bg-error/90 shadow-md shadow-error/20",
        outline:
          "border border-border bg-transparent hover:bg-surface-hover hover:border-border-hover text-text",
        ghost:
          "bg-transparent hover:bg-surface-hover text-text-muted hover:text-text",
      },
      size: {
        sm: "h-9 rounded-md px-4 text-xs gap-2",
        md: "h-10 rounded-lg px-5 text-sm gap-2.5",
        lg: "h-12 rounded-lg px-6 text-base gap-3",
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
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
