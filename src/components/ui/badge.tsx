import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-1.5 py-0 text-[0.6875rem] font-medium tracking-wide whitespace-nowrap uppercase transition-colors duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-primary/15 text-primary ring-1 ring-primary/25 [a]:hover:bg-primary/25",
        secondary:
          "bg-secondary text-secondary-foreground ring-1 ring-border [a]:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        destructive:
          "bg-destructive/10 text-destructive ring-1 ring-destructive/20 focus-visible:ring-destructive/20 dark:bg-destructive/15 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-muted-foreground ring-1 ring-border [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "text-primary normal-case tracking-normal underline-offset-4 hover:text-primary/80 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
