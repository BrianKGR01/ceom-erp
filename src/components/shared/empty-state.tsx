import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Estados vacios que invitan a actuar, nunca un error — design-system.md
// principio 6 ("Mensajes vacios, nunca errores").
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-navy">{title}</p>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {action && (
        <Button render={<Link href={action.href} />} nativeButton={false} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
