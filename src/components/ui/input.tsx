import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// Campo de texto del design system v1.0, seccion 07:
// alto 40px · radio 6px · padding lateral 12px · texto 12px.
// El borde de foco es de 1.5px en el azul de marca, no un ring grueso.
// `text-base md:text-xs`: 16px en movil evita el zoom automatico de iOS al
// enfocar; a partir de md baja a los 12px de la escala del sistema.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-text-placeholder focus-visible:border-[1.5px] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-placeholder aria-invalid:border-[1.5px] aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 md:text-xs",
        className
      )}
      {...props}
    />
  )
}

export { Input }
