# Manifiesto de acceso

Declara el nivel de acceso esperado de cada función exportada de un archivo `"use server"`.
`access-manifest.test.ts` enumera esas funciones por AST y **falla la suite si alguna no está
clasificada** — agregar un endpoint nuevo sin declararlo rompe el build, no pasa desapercibido.

## Cómo agregar una entrada

1. Corré `pnpm test access-manifest` — el error lista exactamente qué función falta (o qué entrada
   quedó obsoleta después de un rename).
2. Abrí `access-manifest.ts` y agregá la clave `"<ruta-relativa-desde-src>::<nombreFuncion>"` con su
   `nivel` (ver los 5 valores y la prioridad de clasificación en el comentario de cabecera del
   archivo) y `verificacion: "estatica"`.
3. Volvé a correr el test. Si falla la prueba de "evidencia textual", el análisis estático no
   encontró el guard esperado (`esOwner`, `tienePermiso(`, etc.) en tu función ni en la que delega
   hasta 2 saltos — o falta el guard de verdad (arreglalo), o el caso es genuinamente indirecto para
   analizarse por texto: cambiá `verificacion` a `"manual"` y explicá por qué en `nota` (nunca dejes
   una entrada "estatica" que el test no puede confirmar).

No hace falta tocar `access-manifest.test.ts` — el escáner (AST + resolución de imports) es genérico,
solo `access-manifest.ts` cambia por endpoint nuevo.
