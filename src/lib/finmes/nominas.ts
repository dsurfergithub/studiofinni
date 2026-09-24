import { MesFinanciero, Movimiento, NominaAncla } from '../storage/types';
import { esAjusteDeSaldo } from '../saldo/cuadre';
import { normalizarConcepto } from '../categorias/sugerencias';

/** Palabras que delatan una nómina (o lo que hace sus veces: pensión, paro…). */
const RE_NOMINA = /\b(nomina|nominas|salario|sueldo|payroll|salary|pension|prestacion|prestaciones|haberes)\b/;

/**
 * Ingresos que NUNCA marcan el inicio de un periodo: dinero que se mueve entre tus cuentas
 * o que te devuelven. Con el criterio de "el ingreso más grande del mes", un traspaso desde
 * otra cuenta le ganaba a la nómina y el periodo empezaba el día que no era.
 */
const RE_NO_NOMINA = /\b(traspaso|bizum|devolucion|reembolso|reintegro|abono tarjeta|excluid[oa]s?)\b|transferencia desde|entre cuentas/;

const dia = (fecha: string) => Number(fecha.slice(8, 10));

/** Distancia entre dos días del mes, dando la vuelta: el 30 y el 1 están a 1 día. */
function distanciaDia(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 31 - d);
}

function mediana(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Detecta las nóminas de un historial de movimientos: una por mes natural. Sus fechas
 * son las que abren cada periodo financiero, así que si se elige mal, el periodo empieza
 * el día equivocado y los gastos "se van" al mes de al lado.
 *
 * 1. Si hay ingresos que se llaman nómina (por concepto o por categoría) en al menos dos
 *    meses, solo cuentan esos.
 * 2. Si en un mes hay más de una (la paga extra de junio y diciembre), se queda con la
 *    que cae en el día de cobro habitual, no con la más grande.
 * 3. Si no hay nada con pinta de nómina, el ingreso más grande de cada mes, sin contar
 *    traspasos, Bizums ni devoluciones.
 */
export function detectarNominas(
  movimientos: Movimiento[],
  nombreCategoria: (id: string) => string = id => id
): NominaAncla[] {
  const ingresos = movimientos.filter(m => m.importe > 0 && !esAjusteDeSaldo(m));
  const texto = (m: Movimiento) => normalizarConcepto(`${m.concepto} ${nombreCategoria(m.categoria)}`);

  const pareceNomina = ingresos.filter(m => RE_NOMINA.test(texto(m)) && !RE_NO_NOMINA.test(texto(m)));
  const mesesConNomina = new Set(pareceNomina.map(m => m.fecha.slice(0, 7)));

  let elegidas: Movimiento[];
  if (mesesConNomina.size >= 2) {
    const diaHabitual = mediana(pareceNomina.map(m => dia(m.fecha)));
    elegidas = unaPorMes(pareceNomina, (a, b) =>
      distanciaDia(dia(a.fecha), diaHabitual) - distanciaDia(dia(b.fecha), diaHabitual) || b.importe - a.importe
    );
  } else {
    const limpios = ingresos.filter(m => !RE_NO_NOMINA.test(texto(m)));
    elegidas = unaPorMes(limpios.length > 0 ? limpios : ingresos, (a, b) => b.importe - a.importe);
  }

  return elegidas
    .map(m => ({ id: m.id, fecha: m.fecha, importe: m.importe, concepto: m.concepto, movimientoId: m.id }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Se queda con el mejor movimiento de cada mes natural según `mejorPrimero`. */
function unaPorMes(movs: Movimiento[], mejorPrimero: (a: Movimiento, b: Movimiento) => number): Movimiento[] {
  const porMes = new Map<string, Movimiento>();
  for (const m of movs) {
    const clave = m.fecha.slice(0, 7);
    const actual = porMes.get(clave);
    if (!actual || mejorPrimero(m, actual) < 0) porMes.set(clave, m);
  }
  return Array.from(porMes.values());
}

/**
 * Quita los periodos personalizados que pisan a los que salen de las nóminas. Pasa si
 * empezaste "desde cero" (meses del 1 al 31) y luego importas un extracto: sin esto,
 * septiembre aparecía dos veces con fechas distintas y un gasto contaba en el que no era.
 * Los que comparten id con un periodo derivado son ediciones del usuario y se respetan.
 */
export function quitarPeriodosSolapados(personalizados: MesFinanciero[], derivados: MesFinanciero[]): MesFinanciero[] {
  const idsDerivados = new Set(derivados.map(m => m.id));
  return personalizados.filter(p =>
    idsDerivados.has(p.id) || !derivados.some(d => p.inicio <= d.fin && d.inicio <= p.fin)
  );
}
