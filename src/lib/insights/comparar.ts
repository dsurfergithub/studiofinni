import { Movimiento } from '../storage/types';
import { esAjusteDeSaldo } from '../saldo/cuadre';

export const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Las comparativas van por mes NATURAL (del 1 al último día), no por periodo de nómina:
// «enero 2025 contra enero 2026» tiene que significar lo mismo los dos años, y los
// periodos de nómina cambian de día de inicio de un mes a otro.

/** Los ajustes de cuadre corrigen el saldo: no son gasto ni ingreso comparable. */
const cuenta = (m: Movimiento) => !esAjusteDeSaldo(m);

export interface Totales {
  ingresos: number;
  gastos: number;
  /** ingresos − gastos */
  ahorro: number;
  movimientos: number;
}

/** «2026-01» → «Enero 2026». */
export function nombreMes(clave: string): string {
  const [y, m] = clave.split('-');
  return `${MES_LARGO[Number(m) - 1]} ${y}`;
}

/** Meses naturales con algún movimiento, del más reciente al más antiguo. */
export function mesesConDatos(movs: Movimiento[]): string[] {
  const set = new Set<string>();
  movs.forEach(m => { if (cuenta(m)) set.add(m.fecha.slice(0, 7)); });
  return Array.from(set).sort().reverse();
}

/** Mismo mes del año anterior: «2026-01» → «2025-01». */
export function mismoMesAnioAnterior(clave: string): string {
  const [y, m] = clave.split('-');
  return `${Number(y) - 1}-${m}`;
}

/** Totales de todo lo que empiece por `prefijo`: un mes («2026-01») o un año («2026»). */
export function totalesDe(movs: Movimiento[], prefijo: string, filtro: (m: Movimiento) => boolean = () => true): Totales {
  let ingresos = 0, gastos = 0, n = 0;
  for (const m of movs) {
    if (!cuenta(m) || !m.fecha.startsWith(prefijo) || !filtro(m)) continue;
    n++;
    if (m.importe > 0) ingresos += m.importe;
    else gastos += -m.importe;
  }
  return { ingresos, gastos, ahorro: ingresos - gastos, movimientos: n };
}

export interface FilaCategoria {
  id: string;
  a: number;
  b: number;
  /** a − b: positivo = en A se gastó más. */
  diff: number;
}

/** Gasto por categoría en dos meses, de la que más cambia a la que menos. */
export function compararCategorias(movs: Movimiento[], a: string, b: string): FilaCategoria[] {
  const filas = new Map<string, FilaCategoria>();
  for (const m of movs) {
    if (!cuenta(m) || m.importe >= 0) continue;
    const mes = m.fecha.slice(0, 7);
    if (mes !== a && mes !== b) continue;
    const fila = filas.get(m.categoria) || { id: m.categoria, a: 0, b: 0, diff: 0 };
    if (mes === a) fila.a += -m.importe;
    else fila.b += -m.importe;
    filas.set(m.categoria, fila);
  }
  return Array.from(filas.values())
    .map(f => ({ ...f, diff: f.a - f.b }))
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || y.a + y.b - (x.a + x.b));
}

/** Cambio relativo de `b` a `a`, o null si no hay base con la que comparar. */
export function variacion(a: number, b: number): number | null {
  if (b === 0) return null;
  return (a - b) / Math.abs(b);
}

export type Metrica = 'gastos' | 'ingresos';

/**
 * Una fila por mes (Ene…Dic) con el total de cada año. `null` = ese mes de ese año no
 * tiene ningún movimiento (futuro o antes de tu primer extracto), para que la línea se
 * corte en vez de caer a cero y parecer que ese mes no gastaste nada.
 */
export function serieAnual(movs: Movimiento[], anios: number[], metrica: Metrica): Record<string, number | string | null>[] {
  const conDatos = new Set(mesesConDatos(movs));
  return MES_CORTO.map((nombre, i) => {
    const fila: Record<string, number | string | null> = { mes: nombre };
    for (const anio of anios) {
      const clave = `${anio}-${String(i + 1).padStart(2, '0')}`;
      fila[String(anio)] = conDatos.has(clave) ? totalesDe(movs, clave)[metrica] : null;
    }
    return fila;
  });
}

/**
 * Totales de un año hasta un mes (incluido). Sirve para comparar el año en curso con el
 * anterior en igualdad: enero-septiembre contra enero-septiembre, no contra el año entero.
 */
export function acumuladoHasta(movs: Movimiento[], anio: number, hastaMes: number): Totales {
  return totalesDe(movs, String(anio), m => Number(m.fecha.slice(5, 7)) <= hastaMes);
}

/** Años con datos, del más reciente al más antiguo. */
export function aniosConDatos(movs: Movimiento[]): number[] {
  return Array.from(new Set(mesesConDatos(movs).map(c => Number(c.slice(0, 4))))).sort((a, b) => b - a);
}
