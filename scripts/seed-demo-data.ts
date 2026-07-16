// Puebla con datos de prueba realistas un tenant que ya existe (pensado
// para el tenant de prueba persistente del usuario, owner@ceom.local, pero
// funciona con cualquier owner real) — para que cada pantalla ya
// construida se vea con informacion real en vez de estados vacios.
//
// Usa siempre las funciones de negocio reales de cada modulo (nunca INSERT
// crudo a productos/ventas/etc.) para no saltarse ninguna regla real —
// mismo criterio que seed-tenant.ts. Respeta el orden obligatorio de
// Modulo_02 regla 4 (no se puede vender sin stock): categorias -> productos
// -> stock -> canales/metodos/clientes -> ventas -> ajustes.
//
// Uso:
//   pnpm seed:demo [email=owner@ceom.local] [--force]
//
// Sin --force, aborta si el tenant ya tiene productos cargados (para no
// duplicar todo si se corre dos veces por accidente).

import { eq } from "drizzle-orm";
import { client as pgClient, db } from "@/db/client";
import { listarSucursalesPorTenant } from "@/modules/identidad/actions";
import * as identidadRepo from "@/modules/identidad/repository";
import { usuarios } from "@/modules/identidad/schema";
import {
  configurarStockMinimo,
  crearCategoria,
  crearProducto,
  listarProductos,
  registrarEntradaCompraReventa,
} from "@/modules/productos/actions";
import {
  crearCanalVenta,
  crearCliente,
  crearMetodoPago,
  registrarAjusteVenta,
  registrarVenta,
} from "@/modules/ventas/actions";

const DIA_MS = 24 * 60 * 60 * 1000;
function haceNDias(n: number) {
  return new Date(Date.now() - n * DIA_MS).toISOString();
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const email = args.find((a) => !a.startsWith("--")) ?? "owner@ceom.local";

  for (const variable of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "DATABASE_URL"]) {
    if (!process.env[variable]) {
      console.error(`Falta ${variable} en .env.local — ver .env.example.`);
      process.exitCode = 1;
      return;
    }
  }

  const [fila] = await db.select().from(usuarios).where(eq(usuarios.email, email));
  if (!fila) {
    console.error(`No existe ningún usuario con email ${email}.`);
    process.exitCode = 1;
    return;
  }
  const owner = await identidadRepo.obtenerUsuarioConRolPorId(fila.id);
  if (!owner) {
    console.error(`No se pudo resolver el usuario/rol de ${email}.`);
    process.exitCode = 1;
    return;
  }

  const existentes = await listarProductos(owner, owner.tenantId);
  if (existentes.ok && existentes.data.length > 0 && !force) {
    console.error(
      `El tenant de ${email} ya tiene ${existentes.data.length} producto(s) cargado(s). ` +
        "Corré con --force si igual querés agregar más datos encima."
    );
    process.exitCode = 1;
    return;
  }

  const sucursalesResultado = await listarSucursalesPorTenant(owner, owner.tenantId);
  if (!sucursalesResultado.ok || sucursalesResultado.data.length === 0) {
    console.error("El tenant no tiene ninguna sucursal — no se puede cargar stock.");
    process.exitCode = 1;
    return;
  }
  const sucursal = sucursalesResultado.data.find((s) => s.esPrincipal) ?? sucursalesResultado.data[0];

  // --- 1. Categorías ---
  const NOMBRES_CATEGORIA = ["Panadería", "Lácteos", "Bebidas", "Snacks"];
  const categoriaIdPorNombre: Record<string, string> = {};
  for (const nombre of NOMBRES_CATEGORIA) {
    const resultado = await crearCategoria(owner, owner.tenantId, { nombre });
    if (!resultado.ok) throw new Error(`crearCategoria(${nombre}): ${resultado.error}`);
    categoriaIdPorNombre[nombre] = resultado.data.categoriaId;
  }
  console.log(`✓ ${NOMBRES_CATEGORIA.length} categorías creadas.`);

  // --- 2. Productos ---
  const PRODUCTOS = [
    { nombre: "Pan Artesanal Masa Madre", categoria: "Panadería", unidad: "unidad", precio: 4.5, costo: 2.2, stock: 30 },
    { nombre: "Croissant de Mantequilla", categoria: "Panadería", unidad: "unidad", precio: 5.5, costo: 2.8, stock: 25 },
    { nombre: "Torta de Chocolate (porción)", categoria: "Panadería", unidad: "unidad", precio: 6.0, costo: 3.0, stock: 15 },
    { nombre: "Leche Fresca Entera 1L", categoria: "Lácteos", unidad: "l", precio: 2.8, costo: 1.6, stock: 40 },
    { nombre: "Queso Cheddar Añejo 250g", categoria: "Lácteos", unidad: "unidad", precio: 6.2, costo: 3.5, stock: 8 },
    { nombre: "Yogurt Natural 200g", categoria: "Lácteos", unidad: "unidad", precio: 1.8, costo: 0.9, stock: 35 },
    { nombre: "Café Espresso Tostado Medio", categoria: "Bebidas", unidad: "unidad", precio: 12.0, costo: 6.5, stock: 20 },
    { nombre: "Jugo de Naranja Natural 1L", categoria: "Bebidas", unidad: "l", precio: 3.2, costo: 1.5, stock: 18 },
    { nombre: "Agua Mineral 600ml", categoria: "Bebidas", unidad: "unidad", precio: 1.0, costo: 0.4, stock: 50 },
    { nombre: "Mix de Frutos Secos 100g", categoria: "Snacks", unidad: "unidad", precio: 3.15, costo: 1.6, stock: 5 },
    { nombre: "Galletas de Avena", categoria: "Snacks", unidad: "unidad", precio: 2.5, costo: 1.1, stock: 22 },
  ] as const;

  const productoIdPorNombre: Record<string, string> = {};
  for (const p of PRODUCTOS) {
    const resultado = await crearProducto(owner, owner.tenantId, {
      categoriaId: categoriaIdPorNombre[p.categoria],
      nombre: p.nombre,
      unidadVenta: p.unidad,
      precioVenta: p.precio,
      costoOperativoVigente: p.costo,
      tipoOrigenProducto: "reventa_simple",
      origenCosto: "manual",
    });
    if (!resultado.ok) throw new Error(`crearProducto(${p.nombre}): ${resultado.error}`);
    productoIdPorNombre[p.nombre] = resultado.data.productoId;

    const entrada = await registrarEntradaCompraReventa(owner, owner.tenantId, {
      productoId: resultado.data.productoId,
      sucursalId: sucursal.id,
      cantidad: p.stock,
      costoCompra: p.costo,
    });
    if (!entrada.ok) throw new Error(`registrarEntradaCompraReventa(${p.nombre}): ${entrada.error}`);
  }
  console.log(`✓ ${PRODUCTOS.length} productos creados, con stock inicial cargado.`);

  // --- 3. Canales de venta y métodos de pago ---
  const canalTienda = await crearCanalVenta(owner, owner.tenantId, { nombre: "Tienda" });
  if (!canalTienda.ok) throw new Error(`crearCanalVenta(Tienda): ${canalTienda.error}`);
  const canalRedes = await crearCanalVenta(owner, owner.tenantId, {
    nombre: "Redes sociales",
    porcentajeComisionDefault: 5,
  });
  if (!canalRedes.ok) throw new Error(`crearCanalVenta(Redes sociales): ${canalRedes.error}`);
  const canalIdTienda = canalTienda.data.canalVentaId;
  const canalIdRedes = canalRedes.data.canalVentaId;

  const metodoIdPorNombre: Record<string, string> = {};
  for (const nombre of ["Efectivo", "Transferencia", "Tarjeta"]) {
    const resultado = await crearMetodoPago(owner, owner.tenantId, { nombre });
    if (!resultado.ok) throw new Error(`crearMetodoPago(${nombre}): ${resultado.error}`);
    metodoIdPorNombre[nombre] = resultado.data.metodoPagoId;
  }
  console.log("✓ 2 canales de venta y 3 métodos de pago creados.");

  // --- 4. Clientes ---
  const NOMBRES_CLIENTE = [
    { nombre: "María González", telefono: "77712345" },
    { nombre: "Carlos Ruiz", telefono: "77723456" },
    { nombre: "Lucía Méndez", telefono: "77734567" },
    { nombre: "Distribuidora Norte", telefono: "77745678" },
    { nombre: "Juan Pérez", telefono: "77756789" },
  ];
  const clienteIdPorNombre: Record<string, string> = {};
  for (const c of NOMBRES_CLIENTE) {
    const resultado = await crearCliente(owner, owner.tenantId, c);
    if (!resultado.ok) throw new Error(`crearCliente(${c.nombre}): ${resultado.error}`);
    clienteIdPorNombre[c.nombre] = resultado.data.clienteId;
  }
  console.log(`✓ ${NOMBRES_CLIENTE.length} clientes creados.`);

  // --- 5. Ventas ---
  const metodos = Object.values(metodoIdPorNombre);
  interface DefLinea {
    producto: string;
    cantidad: number;
  }
  interface DefVenta {
    dias: number;
    cliente?: string;
    canal: string;
    lineas: DefLinea[];
    pago: "total" | "parcial" | "pendiente";
  }
  const VENTAS: DefVenta[] = [
    { dias: 28, cliente: "María González", canal: canalIdTienda, lineas: [{ producto: "Pan Artesanal Masa Madre", cantidad: 2 }, { producto: "Leche Fresca Entera 1L", cantidad: 1 }], pago: "total" },
    { dias: 27, canal: canalIdRedes, lineas: [{ producto: "Café Espresso Tostado Medio", cantidad: 1 }], pago: "total" },
    { dias: 25, cliente: "Carlos Ruiz", canal: canalIdTienda, lineas: [{ producto: "Croissant de Mantequilla", cantidad: 3 }, { producto: "Yogurt Natural 200g", cantidad: 2 }], pago: "parcial" },
    { dias: 24, canal: canalIdTienda, lineas: [{ producto: "Agua Mineral 600ml", cantidad: 4 }, { producto: "Galletas de Avena", cantidad: 2 }], pago: "total" },
    { dias: 22, cliente: "Lucía Méndez", canal: canalIdRedes, lineas: [{ producto: "Torta de Chocolate (porción)", cantidad: 1 }], pago: "pendiente" },
    { dias: 21, cliente: "Distribuidora Norte", canal: canalIdTienda, lineas: [{ producto: "Pan Artesanal Masa Madre", cantidad: 5 }, { producto: "Leche Fresca Entera 1L", cantidad: 3 }, { producto: "Jugo de Naranja Natural 1L", cantidad: 2 }], pago: "parcial" },
    { dias: 20, canal: canalIdTienda, lineas: [{ producto: "Café Espresso Tostado Medio", cantidad: 1 }, { producto: "Agua Mineral 600ml", cantidad: 2 }], pago: "total" },
    { dias: 19, cliente: "Juan Pérez", canal: canalIdRedes, lineas: [{ producto: "Croissant de Mantequilla", cantidad: 2 }], pago: "total" },
    { dias: 18, cliente: "María González", canal: canalIdTienda, lineas: [{ producto: "Yogurt Natural 200g", cantidad: 3 }, { producto: "Galletas de Avena", cantidad: 1 }], pago: "total" },
    { dias: 16, canal: canalIdTienda, lineas: [{ producto: "Queso Cheddar Añejo 250g", cantidad: 2 }], pago: "total" },
    { dias: 15, cliente: "Carlos Ruiz", canal: canalIdRedes, lineas: [{ producto: "Jugo de Naranja Natural 1L", cantidad: 1 }, { producto: "Agua Mineral 600ml", cantidad: 3 }], pago: "pendiente" },
    { dias: 14, canal: canalIdTienda, lineas: [{ producto: "Pan Artesanal Masa Madre", cantidad: 3 }, { producto: "Croissant de Mantequilla", cantidad: 2 }], pago: "parcial" },
    { dias: 12, cliente: "Lucía Méndez", canal: canalIdTienda, lineas: [{ producto: "Mix de Frutos Secos 100g", cantidad: 2 }], pago: "total" },
    { dias: 10, canal: canalIdRedes, lineas: [{ producto: "Café Espresso Tostado Medio", cantidad: 1 }, { producto: "Torta de Chocolate (porción)", cantidad: 1 }], pago: "total" },
    { dias: 8, cliente: "Juan Pérez", canal: canalIdTienda, lineas: [{ producto: "Leche Fresca Entera 1L", cantidad: 2 }, { producto: "Yogurt Natural 200g", cantidad: 2 }, { producto: "Galletas de Avena", cantidad: 2 }], pago: "parcial" },
    { dias: 6, cliente: "Distribuidora Norte", canal: canalIdTienda, lineas: [{ producto: "Pan Artesanal Masa Madre", cantidad: 10 }, { producto: "Agua Mineral 600ml", cantidad: 10 }], pago: "total" },
    { dias: 3, canal: canalIdRedes, lineas: [{ producto: "Croissant de Mantequilla", cantidad: 1 }], pago: "pendiente" },
    { dias: 1, cliente: "María González", canal: canalIdTienda, lineas: [{ producto: "Café Espresso Tostado Medio", cantidad: 2 }, { producto: "Jugo de Naranja Natural 1L", cantidad: 1 }], pago: "total" },
  ];

  const ventaIds: string[] = [];
  for (const [i, v] of VENTAS.entries()) {
    const precioPorProducto = new Map<string, number>(PRODUCTOS.map((p) => [p.nombre, p.precio]));
    const subtotal = v.lineas.reduce(
      (acc, l) => acc + (precioPorProducto.get(l.producto) ?? 0) * l.cantidad,
      0
    );
    const metodoPagoId = metodos[i % metodos.length];

    const resultado = await registrarVenta(owner, owner.tenantId, {
      sucursalId: sucursal.id,
      clienteId: v.cliente ? clienteIdPorNombre[v.cliente] : undefined,
      canalVentaId: v.canal,
      fechaVenta: haceNDias(v.dias),
      lineas: v.lineas.map((l) => ({
        productoId: productoIdPorNombre[l.producto],
        cantidad: l.cantidad,
      })),
      pagoInicial:
        v.pago === "total"
          ? { metodoPagoId, monto: subtotal }
          : v.pago === "parcial"
            ? { metodoPagoId, monto: Number((subtotal * 0.5).toFixed(2)) }
            : undefined,
    });
    if (!resultado.ok) throw new Error(`registrarVenta #${i + 1}: ${resultado.error}`);
    ventaIds.push(resultado.data.ventaId);
  }
  console.log(`✓ ${VENTAS.length} ventas registradas.`);

  // --- 6. Ajustes de venta (para poblar la card "Ajustes" de la ficha) ---
  const ajusteDevolucion = await registrarAjusteVenta(owner, ventaIds[0], {
    tipo: "devolucion",
    montoAjuste: -2.8,
    productoId: productoIdPorNombre["Leche Fresca Entera 1L"],
    cantidadProductoAjustada: 1,
    motivo: "Cliente devolvió 1 unidad — producto vencido.",
  });
  if (!ajusteDevolucion.ok) throw new Error(`registrarAjusteVenta (devolución): ${ajusteDevolucion.error}`);

  const ajusteCorreccion = await registrarAjusteVenta(owner, ventaIds[8], {
    tipo: "correccion",
    montoAjuste: -1.0,
    motivo: "Corrección de vuelto mal entregado en caja.",
  });
  if (!ajusteCorreccion.ok) throw new Error(`registrarAjusteVenta (corrección): ${ajusteCorreccion.error}`);
  console.log("✓ 2 ajustes de venta registrados.");

  // --- 7. Stock mínimo en los productos con poco stock, para que el badge
  // "Stock bajo" de la Ficha de Producto tenga con qué dispararse de verdad.
  for (const nombre of ["Queso Cheddar Añejo 250g", "Mix de Frutos Secos 100g"]) {
    const resultado = await configurarStockMinimo(owner, productoIdPorNombre[nombre], sucursal.id, 10);
    if (!resultado.ok) throw new Error(`configurarStockMinimo(${nombre}): ${resultado.error}`);
  }
  console.log("✓ Stock mínimo configurado en 2 productos.");

  console.log(`\nListo — tenant de ${email} poblado con datos de prueba.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end();
  });
