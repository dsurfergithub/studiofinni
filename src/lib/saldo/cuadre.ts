import { AppState, Categoria, Movimiento } from '../storage/types';

/**
 * Categoría en la que aterrizan los ajustes de cuadre. Se crea sola la primera vez.
 * No consume presupuesto (los movimientos se marcan `enPresupuesto: false`).
 */
export const CAT_AJUSTE_ID = 'ajuste-de-saldo';

export const CATEGORIA_AJUSTE: Categoria = {
  id: CAT_AJUSTE_ID,
  nombre: 'Ajuste de saldo',
  color: '#7a7a92',
  icono: 'Scale',
  tipo: 'ambos',
  macro: 'variable',
};

/**
 * Un ajuste de cuadre NO es un ingreso ni un gasto: es la corrección del error
 * acumulado. Cuenta en el saldo y aparece en la lista de movimientos, pero se
 * excluye de los totales de ingresos/gastos y del presupuesto para no inflarlos.
 */
export function esAjusteDeSaldo(mov: Movimiento): boolean {
  return mov.categoria === CAT_AJUSTE_ID;
}

type Cuenta = AppState['cuenta'];

/**
 * Saldo corrido de la cuenta: el saldo real anclado en `fechaSaldo` más TODO lo
 * que se ha movido después. Convenio: `saldoActual` es el saldo al CIERRE de
 * `fechaSaldo`, así que los movimientos de ese mismo día ya están dentro y solo
 * cuentan los estrictamente posteriores.
 */
export function calcularSaldo(cuenta: Cuenta, movimientos: Movimiento[]): number {
  if (!cuenta.fechaSaldo && movimientos.length === 0) return 0;
  if (!cuenta.fechaSaldo) return movimientos.reduce((acc, m) => acc + m.importe, 0);
  const delta = movimientos
    .filter(m => m.fecha > cuenta.fechaSaldo)
    .reduce((sum, m) => sum + m.importe, 0);
  return cuenta.saldoActual + delta;
}

export interface Cuadre {
  /** Lo que la app venía calculando antes de cuadrar. */
  saldoApp: number;
  /** Lo que dice el banco (lo que teclea el usuario). */
  saldoReal: number;
  /** saldoReal − saldoApp. Positivo = a la app le faltaba dinero. */
  diferencia: number;
  /** Nueva ancla: el saldo del banco pasa a ser la verdad a fecha de hoy. */
  cuenta: Cuenta;
  /** Movimiento que deja constancia del ajuste. `null` si no hay diferencia. */
  movimiento: Movimiento | null;
  /** true si hay que dar de alta la categoría de ajuste. */
  necesitaCategoria: boolean;
  /**
   * Movimientos con fecha POSTERIOR a hoy (gastos planificados). Siguen sumando
   * al saldo, así que tras cuadrar el Dashboard no mostrará exactamente `saldoReal`.
   */
  movimientosFuturos: number;
}

/**
 * Prepara el cuadre contra el banco: mueve el ancla del saldo a `hoy` con la cifra
 * real y devuelve un movimiento de ajuste por la diferencia acumulada (duplicados,
 * ingresos sin apuntar, importes mal tecleados…).
 *
 * El movimiento de ajuste se fecha en `hoy`, es decir EN el ancla y no después, de
 * modo que no vuelve a mover el saldo: solo explica el salto en la lista de
 * movimientos y en los totales del periodo en curso.
 *
 * Función pura: no toca el estado, devuelve las piezas para que las aplique el store.
 */
export function prepararCuadre(state: AppState, saldoReal: number, hoy: string, id: string): Cuadre {
  const saldoApp = calcularSaldo(state.cuenta, state.movimientos);
  // El `+ 0` normaliza el -0 que sale de toFixed cuando ya cuadra (así el signo
  // que se muestra en pantalla nunca es un «−0,00 €»).
  const diferencia = Number((saldoReal - saldoApp).toFixed(2)) + 0;
  const cuenta: Cuenta = { ...state.cuenta, saldoActual: saldoReal, fechaSaldo: hoy };

  const movimiento: Movimiento | null = diferencia === 0 ? null : {
    id,
    fecha: hoy,
    importe: diferencia,
    concepto: 'Ajuste de saldo (cuadre con el banco)',
    categoria: CAT_AJUSTE_ID,
    fuente: 'manual',
    hash: id,
    enPresupuesto: false,
    notas: `Saldo de la app: ${saldoApp.toFixed(2)} € · saldo del banco: ${saldoReal.toFixed(2)} €`,
  };

  return {
    saldoApp,
    saldoReal,
    diferencia,
    cuenta,
    movimiento,
    necesitaCategoria: movimiento !== null && !state.categorias.some(c => c.id === CAT_AJUSTE_ID),
    movimientosFuturos: state.movimientos.filter(m => m.fecha > hoy).length,
  };
}
