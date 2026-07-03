# Finni · v2.1

App de **finanzas personales** (PWA instalable en iOS/Android). Funciona 100% en el cliente: tus datos se guardan en `localStorage` y nunca salen del dispositivo. Desde la v2.1 la app funciona **sin conexión** (service worker + fuentes auto-hospedadas).

## Novedades de la v2.1

- 📊 **Plan anual con datos reales**: vistas Plan / ¿Y si…? / Real, con diferencias en color.
- 🧩 **Macro-grupos por categoría** (fijo, variable, inversión) que alimentan el plan automáticamente.
- 🧪 **Escenario "¿y si…?"**: copia editable del plan para probar cambios sin tocarlo.
- 💶 **Ingresos recurrentes** (nómina, alquileres) junto a las suscripciones.
- 🐷 **Aportaciones a metas de ahorro** registradas como movimientos.
- 🔎 Búsqueda en todos los meses, **export CSV**, sugerencia automática de categoría.
- 📣 **Aviso de novedades** tras cada actualización + historial en Ajustes (`src/lib/changelog.ts`).
- 📴 **Offline-first** con `vite-plugin-pwa`.

## Stack

React 19 · Vite 6 · TypeScript · TailwindCSS v4 · Recharts · Lucide · vite-plugin-pwa · Vitest.

## Desarrollo local

**Requisitos:** Node.js 18+

```bash
npm install
npm run dev      # http://localhost:3000
```

Otros scripts:

```bash
npm run build    # genera dist/ (incluye service worker)
npm run preview  # sirve el build de producción
npm test         # tests unitarios (vitest)
npm run lint     # type-check con tsc
```

## Publicar una versión nueva

1. Sube `version` en `package.json`.
2. Añade una entrada al principio de `CHANGELOG` en `src/lib/changelog.ts` (y actualiza `APP_VERSION`): es lo que verá el usuario en el aviso de novedades.
3. Haz deploy. El service worker se actualiza solo y, al abrir, cada usuario ve una vez el panel de novedades.

## Desplegar en Vercel

El repo ya incluye `vercel.json` (framework Vite, salida `dist`, rewrites SPA que excluyen `sw.js` y assets).

1. En Vercel: **New Project → Import** este repositorio.
2. Framework Preset: **Vite** (autodetectado). Build: `vite build`. Output: `dist`.
3. **Deploy**. No se necesitan variables de entorno: la app es estática y todo se procesa en el navegador.
