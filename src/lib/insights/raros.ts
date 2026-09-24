import { MesFinanciero, Movimiento } from '../storage/types';
import { movimientoEnMes } from '../finmes/finmes';
import { cuentaEnAnalisis } from '../analisis';

export interface GastoRaro {
  categoria: string;
  /** Gasto de la categoría en el periodo que se mira. */
  actual: number;
  /** Media de los periodos anteriores (los que no tuvieron gasto cuentan como 0). */
  media: number;
  /** actual − media */
  exceso: number;
  /** Cambio relativo sobre la media, o null si antes no gastabas nada ahí. */
  variacion: number | null;
  /** Cuántos periodos se han usado para la media. */
  periodosBase: number;
}

export interface OpcionesRaros {
  /** Cuánto por encima de la media (0.4 = un 40 %) para avisar. */
  umbral?: number;
  /** Y al menos estos euros: un 200 % de 3 € no merece un aviso. */
  minimoEuros?: number;
  /** Periodos anteriores con los que se calcula la media. */
  periodos?: number;
  /** Una categoría sin historial avisa solo si pasa de esto. */
  minimoNueva?: number;
}

/**
 * Categorías en las que el periodo que miras va claramente por encima de lo habitual:
 * lo que llevas gastado contra la media de los periodos anteriores con movimientos.
 * Con el periodo a medias el aviso sigue siendo válido: ya has pasado la media.
 *
 * Hacen falta al menos dos periodos anteriores: con uno solo, "lo habitual" es un mes
 * cualquiera y avisaría de todo.
 */
export function detectarGastosRaros(
  movimientos: Movimiento[],
  meses: MesFinanciero[],
  mes: MesFinanciero,
  fuera: Set<string>,
  { umbral = 0.4, minimoEuros = 30, periodos = 6, minimoNueva = 100 }: OpcionesRaros = {}
): GastoRaro[] {
  const gastos = movimientos.filter(m => m.importe < 0 && cuentaEnAnalisis(m, fuera));
  const porCategoria = (p: MesFinanciero) => {
    const suma = new Map<string, number>();
    for (const m of gastos) {
      if (movimientoEnMes(m, p, meses)) suma.set(m.categoria, (suma.get(m.categoria) || 0) + -m.importe);
    }
    return suma;
  };

  // Periodos anteriores con algún gasto, del más reciente hacia atrás.
  const anteriores: Map<string, number>[] = [];
  for (const p of [...meses].sort((a, b) => b.inicio.localeCompare(a.inicio))) {
    if (anteriores.length >= periodos) break;
    if (p.inicio >= mes.inicio) continue;
    const suma = porCategoria(p);
    if (suma.size > 0) anteriores.push(suma);
  }
  if (anteriores.length < 2) return [];

  const raros: GastoRaro[] = [];
  for (const [categoria, actual] of porCategoria(mes)) {
    const media = anteriores.reduce((t, s) => t + (s.get(categoria) || 0), 0) / anteriores.length;
    const exceso = actual - media;
    const nueva = media === 0;
    if (nueva ? actual < minimoNueva : exceso < minimoEuros || actual <= media * (1 + umbral)) continue;
    raros.push({ categoria, actual, media, exceso, variacion: nueva ? null : exceso / media, periodosBase: anteriores.length });
  }
  return raros.sort((a, b) => b.exceso - a.exceso);
}
