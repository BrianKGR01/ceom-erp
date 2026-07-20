import { redirect } from "next/navigation";

// /admin redirige al shell real (src/app/admin/(shell)/tenants) — el gate de
// rol ceom_admin ya lo aplica src/app/admin/layout.tsx antes de llegar acá.
export default function AdminHomePage() {
  redirect("/admin/tenants");
}
