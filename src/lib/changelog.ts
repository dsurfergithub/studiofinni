// Historial de versiones de la app. Añade una entrada nueva al principio en cada
// actualización: es lo que ve el usuario en el aviso de novedades y en Ajustes.

export const APP_VERSION = '2.1.0';

export type TipoCambio = 'nuevo' | 'mejora' | 'arreglo';

export interface ChangelogEntry {
  version: string;
  fecha: string; // YYYY-MM-DD
  titulo: string;
  cambios: { tipo: TipoCambio; texto: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.1.0',
    fecha: '2026-07-03',
    titulo: 'Plan con datos reales, escenario y app 100% offline',
    cambios: [
      { tipo: 'nuevo', texto: 'El Plan anual ahora compara tu plan con el gasto real de cada mes, agrupado en Fijos, Variables e Inversión.' },
      { tipo: 'nuevo', texto: 'Escenario "¿y si…?": una copia editable del plan para probar cambios sin tocar el plan base.' },
      { tipo: 'nuevo', texto: 'Cada categoría tiene ahora un macro-grupo (fijo, variable o inversión) que alimenta el plan automáticamente.' },
      { tipo: 'nuevo', texto: 'Ingresos recurrentes: la pantalla de suscripciones también sirve para nóminas o alquileres que cobras cada mes.' },
      { tipo: 'nuevo', texto: 'Aporta dinero a tus metas de ahorro y queda registrado como movimiento.' },
      { tipo: 'nuevo', texto: 'Exporta todos tus movimientos a CSV (Excel) desde Ajustes.' },
      { tipo: 'nuevo', texto: 'Este aviso de novedades: tras cada actualización verás qué ha cambiado. El historial completo está en Ajustes.' },
      { tipo: 'mejora', texto: 'La app funciona sin conexión: puedes abrirla y usarla sin internet una vez instalada.' },
      { tipo: 'mejora', texto: 'Al escribir el concepto de un gasto, la categoría se rellena sola si ya la usaste antes.' },
      { tipo: 'mejora', texto: 'La búsqueda de movimientos puede abarcar todos los meses, no solo el actual.' },
      { tipo: 'mejora', texto: 'Avisos integrados en la app en lugar de las ventanas del navegador.' },
      { tipo: 'arreglo', texto: 'Al añadir un movimiento, la fecha propuesta es siempre hoy (antes podía saltar al final del periodo, p. ej. al 14 de agosto).' },
      { tipo: 'arreglo', texto: 'El mes actual ya no aparece duplicado en el selector tras empezar desde cero.' },
      { tipo: 'arreglo', texto: 'Al editar o reactivar una suscripción, sus cargos pendientes se generan al momento (antes había que reabrir la app).' },
    ],
  },
  {
    version: '2.0.0',
    fecha: '2026-06-15',
    titulo: 'Rediseño con temas, suscripciones y presupuesto independiente',
    cambios: [
      { tipo: 'nuevo', texto: 'Suscripciones con vista anualizada y cargo automático cada periodo.' },
      { tipo: 'nuevo', texto: 'Modo claro y oscuro.' },
      { tipo: 'nuevo', texto: 'Presupuesto independiente del catálogo de categorías, con gastos puntuales que no lo consumen.' },
      { tipo: 'nuevo', texto: 'Insights con gráfico interactivo por categoría y gasto mensual del año.' },
      { tipo: 'nuevo', texto: 'Plan anual editable y traspaso de movimientos entre meses financieros.' },
      { tipo: 'mejora', texto: 'Auto-backup semanal y restauración desde JSON.' },
    ],
  },
];

const LAST_SEEN_KEY = 'finni_last_seen_version';

export function versionVista(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return APP_VERSION;
  }
}

export function marcarVersionVista(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
  } catch {
    // sin almacenamiento no hay aviso que controlar
  }
}

/** true si el usuario aún no ha visto las novedades de la versión instalada. */
export function hayNovedadesSinVer(): boolean {
  return versionVista() !== APP_VERSION;
}
