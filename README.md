# Finni · v2

App de **finanzas personales** (PWA instalable en iOS/Android). Funciona 100% en el cliente: tus datos se guardan en `localStorage` y nunca salen del dispositivo.

## Novedades de la v2

- 🔁 **Suscripciones** con vista anualizada y auto-cargo cada periodo.
- 🌗 **Modo claro y oscuro** (oscuro por defecto, con toggle en Ajustes).
- 🗓️ **Planificación del resto del año** por defecto desde el onboarding.
- 🎯 **Presupuesto independiente** del catálogo de categorías: las añades cuando quieres, con barra de % y de lo que te queda por gastar.
- 🧾 Al añadir un gasto puedes marcarlo como **puntual** (no cuenta para el presupuesto) o **en presupuesto**.
- 📊 **Insights** con donut interactivo (toca una categoría para ver su detalle) y barras de gasto mensual del año.
- 💾 **Auto-backup semanal** + restaurar desde JSON.

## Stack

React 19 · Vite 6 · TypeScript · TailwindCSS v4 · Recharts · Lucide.

## Desarrollo local

**Requisitos:** Node.js 18+

```bash
npm install
npm run dev      # http://localhost:3000
```

Otros scripts:

```bash
npm run build    # genera dist/
npm run preview  # sirve el build de producción
npm run lint     # type-check con tsc
```

## Desplegar en Vercel

El repo ya incluye `vercel.json` (framework Vite, salida `dist`, rewrites SPA).

1. En Vercel: **New Project → Import** este repositorio.
2. Framework Preset: **Vite** (autodetectado). Build: `vite build`. Output: `dist`.
3. **Deploy**. No se necesitan variables de entorno: la app es estática y todo se procesa en el navegador.
