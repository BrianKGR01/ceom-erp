import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Badge de estado — design system v1.0 seccion 07: pill de radio 9999px,
  // texto 10px peso 700, padding 4px 11px. Cada variante lleva SIEMPRE el
  // par semantico completo fondo + texto; ninguna aplica solo uno de los
  // dos (regla de gobernanza, seccion 09).
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-[11px] py-[3px] text-[10px] font-bold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Pares fondo + texto — design system v1.0 seccion 01, semanticos.
        success: "bg-success-bg text-success-text",
        warning: "bg-warning-bg text-warning-text",
        error: "bg-error-bg text-error-text",
        info: "bg-info-bg text-info-text",
        // Pastilla de marca (filtros activos, contadores) — primary-tint
        // sobre el azul de enlace, tal como la muestra el sistema.
        brand: "bg-secondary text-primary",
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
