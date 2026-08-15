import { AppState, CierreMes, MesFinanciero, Movimiento } from '../storage/types';
import { CAT_AJUSTE_ID, CATEGORIA_AJUSTE, esAjusteDeSaldo } from '../saldo/cuadre';

type Cuenta = AppState['cuenta'];

/**
 * Saldo de la cuenta a una fecha dada, hacia adelante o hacia atrás del ancla.
 *
 * Convenio (el mismo de `calcularSaldo`): `saldoActual` es el saldo al CIERRE de
 * `fechaSaldo`, así que los movimientos de ese día ya están dentro. Para ir a otra
 * fecha se suman los que hay entre el ancla y ella, o se restan si vamos hacia atrás.
 * Solo una de las dos sumas tiene contenido.
 */
export function saldoAFecha(cuenta: Cuenta, movimientos: Movimiento[], fecha: string): number {
  // Mismo motivo que en `calcularSaldo`: los ajustes son el recibo de la corrección,
  // no dinero. Si sumaran, al retroceder el ancla se aplicarían dos veces.
  const reales = movimientos.filter(m => !esAjusteDeSaldo(m));
  if (!cuenta.fechaSaldo) {
    return reales.filter(m => m.fecha <= fecha).reduce((s, m) => s + m.importe, 0);
  }
  let saldo = cuenta.saldoActual;
  for (const m of reales) {
    if (m.fecha > cuenta.fechaSaldo && m.fecha <= fecha) saldo += m.importe;
    else if (m.fecha > fecha && m.fecha <= cuenta.fechaSaldo) saldo -= m.importe;
  }
  return saldo;
}

/** Un periodo se puede cerrar cuando ya ha terminado y no está cerrado. */
export function puedeCerrarse(mes: MesFinanciero, hoy: string, cierres: Record<string, CierreMes>): boolean {
  return mes.fin < hoy && !cierres[mes.id];
}

/**
 * Periodos terminados y sin cerrar, del más antiguo al más reciente: se cierran en orden,
 * porque el saldo final de uno es el inicial del siguiente.
 */
export function mesesPendientesDeCierre(meses: MesFinanciero[], hoy: string, cierres: Record<string, CierreMes>): MesFinanciero[] {
  return meses.filter(m => puedeCerrarse(m, hoy, cierres)).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/**
 * Con cuánto empezó el periodo: el saldo final del periodo anterior, si está cerrado.
 * `null` si el anterior no se ha cerrado (o no hay anterior): entonces no lo sabemos, y
 * es mejor no enseñar una cifra inventada.
 */
export function saldoInicialDeMes(
  mes: MesFinanciero,
  meses: MesFinanciero[],
  cierres: Record<string, CierreMes>
): number | null {
  const anteriores = meses.filter(m => m.fin < mes.inicio).sort((a, b) => b.fin.localeCompare(a.fin));
  const previo = anteriores[0];
  if (!previo) return null;
  const cierre = cierres[previo.id];
  return cierre ? cierre.saldoFinal : null;
}

export interface Cierre {
  mes: MesFinanciero;
  /** Lo que la app calculaba para el último día del periodo. */
  saldoCalculado: number;
  /** Lo que dice el banco a esa fecha. */
  saldoFinal: number;
  /** saldoFinal − saldoCalculado. */
  diferencia: number;
  /** El ancla pasa al último día del periodo con la cifra real. */
  cuenta: Cuenta;
  /** Ajuste que deja constancia del descuadre. `null` si no había. */
  movimiento: Movimiento | null;
  necesitaCategoria: boolean;
  registro: CierreMes;
}

/**
 * Prepara el cierre de un periodo: fija su saldo final real y reancla la cuenta a ese día.
 *
 * A diferencia del cuadre libre —que se ancla en HOY—, aquí el ancla va al último día del
 * periodo, así que el saldo hay que buscarlo en el histórico del banco a esa fecha. A
 * cambio, cada periodo arranca con un saldo inicial conocido y los errores dejan de
 * arrastrarse de mes en mes.
 *
 * El ajuste se fecha EN el último día (= en el ancla), así que no vuelve a mover el saldo:
 * solo explica el salto. Función pura.
 */
export function prepararCierre(
  state: AppState,
  mes: MesFinanciero,
  saldoFinal: number,
  id: string,
  ahora = Date.now()
): Cierre {
  const saldoCalculado = saldoAFecha(state.cuenta, state.movimientos, mes.fin);
  const diferencia = Number((saldoFinal - saldoCalculado).toFixed(2)) + 0;

  const movimiento: Movimiento | null = diferencia === 0 ? null : {
    id,
    fecha: mes.fin,
    importe: diferencia,
    concepto: `Ajuste al cerrar ${mes.nombre}`,
    categoria: CAT_AJUSTE_ID,
    fuente: 'manual',
    hash: id,
    enPresupuesto: false,
    // El pin evita que el ajuste se escape al periodo siguiente si alguien mueve las
    // fechas del mes más adelante: pertenece al mes que se está cerrando.
    mesId: mes.id,
    notas: `Saldo de la app: ${saldoCalculado.toFixed(2)} € · saldo del banco: ${saldoFinal.toFixed(2)} €`,
  };

  return {
    mes,
    saldoCalculado,
    saldoFinal,
    diferencia,
    cuenta: { ...state.cuenta, saldoActual: saldoFinal, fechaSaldo: mes.fin },
    movimiento,
    necesitaCategoria: movimiento !== null && !state.categorias.some(c => c.id === CAT_AJUSTE_ID),
    registro: { mesId: mes.id, saldoFinal, fecha: mes.fin, cerradoEn: ahora },
  };
}

export { CATEGORIA_AJUSTE };
