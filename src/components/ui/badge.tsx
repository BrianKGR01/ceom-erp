import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Pill de estado — design-system.md seccion 1/2: bordes muy redondeados
  // (~20px), fondo pastel + texto en el tono fuerte correspondiente.
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Colores de estado — design-system.md seccion 2, tabla de estados.
        success: "bg-success-bg text-success-text",
        warning: "bg-warning-bg text-warning-text",
        error: "bg-error-bg text-error-text",
        info: "bg-info-bg text-info-text",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

function Badge({
  className,
  variant = "info",
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
