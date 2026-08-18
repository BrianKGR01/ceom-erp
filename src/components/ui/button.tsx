import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

// Boton del design system v1.0, seccion 07 "Componentes":
// altura 40px · radio 10px · texto 12px · peso 700.
// Las cinco variantes visuales del sistema son Primario, Secundario,
// Tonal, Atencion y Destructivo; se mapean sobre los nombres de variante
// que ya usaba la app (default / outline / secondary / warning /
// destructive) para no tener que tocar cada llamada.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-xs font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:border-border disabled:bg-muted disabled:text-text-placeholder disabled:opacity-100 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primario — unico boton que lleva la sombra de CTA del sistema.
        default:
          "bg-primary text-primary-foreground shadow-cta hover:bg-brand-dark",
        // Secundario — superficie blanca con borde sutil, peso normal.
        outline:
          "border-border bg-card font-normal text-foreground hover:bg-muted aria-expanded:bg-muted",
        // Tonal — fondo primary-tint con borde de marca.
        secondary:
          "border-primary bg-secondary text-secondary-foreground hover:bg-primary/15 aria-expanded:bg-primary/15",
        ghost:
          "font-normal hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        // Atencion — el naranja de marca se reserva para esto, nunca
        // como color decorativo (regla del design system seccion 09).
        warning: "bg-brand-accent text-brand-accent-fg hover:bg-brand-accent/85",
        // Destructivo — par completo fondo + texto de peligro.
        destructive:
          "border-error-bg bg-error-bg text-error-text hover:bg-error-border",
        link: "font-normal text-primary underline-offset-4 hover:underline",
      },
      size: {
        // 40px es la altura de control del sistema: la comparten botones,
        // inputs y selects para que alineen en una misma fila.
        default:
          "h-10 gap-2 px-[18px] has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1 rounded-md px-2 text-[11px] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-[11px] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-xs":
          "size-7 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    // Unico feedback visual de "esto esta corriendo" en toda la app antes
    // era el texto cambiando a gerundio ("Guardando...") + disabled, ni
    // siquiera parejo en todos los botones — ver
    // docs/ui/AUDITORIA-UI-UX.md UI-022. `loading` agrega un spinner y
    // fuerza `disabled` sin que el consumidor tenga que combinar los dos.
    loading?: boolean
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
