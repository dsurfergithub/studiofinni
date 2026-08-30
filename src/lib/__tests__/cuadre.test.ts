import { describe, it, expect } from 'vitest';
import { calcularSaldo, prepararCuadre, CAT_AJUSTE_ID } from '../saldo/cuadre';
import { AppState, Movimiento } from '../storage/types';

const mov = (fecha: string, importe: number): Movimiento => ({
  id: `${fecha}-${importe}`, fecha, importe, concepto: 'x', categoria: 'c',
  fuente: 'manual', hash: `${fecha}-${importe}`,
});

const baseState = (movimientos: Movimiento[], cuenta: AppState['cuenta']): AppState =>
  ({ movimientos, categorias: [], cuenta } as unknown as AppState);

describe('calcularSaldo', () => {
  it('suma solo lo posterior al ancla (el día del ancla ya está dentro del saldo)', () => {
    const cuenta = { banco: 'b', saldoActual: 100, fechaSaldo: '2026-06-27' };
    const movs = [mov('2026-06-27', -50), mov('2026-06-28', -20), mov('2026-07-01', 5)];
    expect(calcularSaldo(cuenta, movs)).toBe(85);
  });

  it('sin ancla suma todos los movimientos', () => {
    const cuenta = { banco: 'b', saldoActual: 999, fechaSaldo: '' };
    expect(calcularSaldo(cuenta, [mov('2026-01-01', -10), mov('2026-02-01', 30)])).toBe(20);
  });
});

describe('prepararCuadre', () => {
  const cuenta = { banco: 'b', saldoActual: 2086.34, fechaSaldo: '2026-06-27' };
  const movs = [mov('2026-07-01', -2468.79)];
  const state = baseState(movs, cuenta);

  it('reancla con la cifra real y apunta la diferencia', () => {
    const c = prepararCuadre(state, 614, '2026-08-15', 'id-1');
    expect(c.saldoApp).toBeCloseTo(-382.45, 2);
    expect(c.diferencia).toBeCloseTo(996.45, 2);
    // El ancla se fecha AYER para que lo que se apunte hoy siga contando (ver abajo).
    expect(c.cuenta).toEqual({ banco: 'b', saldoActual: 614, fechaSaldo: '2026-08-14' });
    expect(c.movimiento?.fecha).toBe('2026-08-15');
    expect(c.movimiento?.importe).toBeCloseTo(996.45, 2);
    expect(c.movimiento?.categoria).toBe(CAT_AJUSTE_ID);
    expect(c.movimiento?.enPresupuesto).toBe(false);
    expect(c.necesitaCategoria).toBe(true);
  });

  it('tras aplicar el cuadre el saldo es exactamente el del banco', () => {
    const c = prepararCuadre(state, 614, '2026-08-15', 'id-1');
    const despues = [c.movimiento!, ...movs];
    expect(calcularSaldo(c.cuenta, despues)).toBeCloseTo(614, 2);
  });

  it('si ya cuadra no crea movimiento de ajuste', () => {
    const c = prepararCuadre(state, -382.45, '2026-08-15', 'id-1');
    expect(c.diferencia).toBe(0);
    expect(c.movimiento).toBeNull();
    expect(c.necesitaCategoria).toBe(false);
  });

  it('un gasto apuntado HOY después de cuadrar sí baja el saldo', () => {
    // El fallo que esto cubre: con el ancla en hoy, `calcularSaldo` solo suma lo
    // estrictamente posterior, así que el gasto de hoy no contaba nunca más.
    const c = prepararCuadre(state, 614, '2026-08-15', 'id-1');
    const despues = [c.movimiento!, ...movs];
    expect(calcularSaldo(c.cuenta, despues)).toBeCloseTo(614, 2);
    expect(calcularSaldo(c.cuenta, [...despues, mov('2026-08-15', -100)])).toBeCloseTo(514, 2);
  });

  it('cuadra bien aunque ya hubiera movimientos apuntados hoy', () => {
    // El ancla descuenta lo de hoy y `calcularSaldo` lo vuelve a sumar: da el saldo real.
    const conHoy = baseState([...movs, mov('2026-08-15', -40), mov('2026-08-15', 25)], cuenta);
    const c = prepararCuadre(conHoy, 614, '2026-08-15', 'id-1');
    expect(c.cuenta.saldoActual).toBeCloseTo(629, 2); // 614 − (−40 + 25)
    expect(c.cuenta.fechaSaldo).toBe('2026-08-14');
    expect(calcularSaldo(c.cuenta, [c.movimiento!, ...conHoy.movimientos])).toBeCloseTo(614, 2);
    // Y un gasto nuevo de hoy sigue restando.
    expect(calcularSaldo(c.cuenta, [c.movimiento!, ...conHoy.movimientos, mov('2026-08-15', -10)]))
      .toBeCloseTo(604, 2);
  });

  it('el ancla retrocede bien aunque hoy sea día 1 de mes', () => {
    const c = prepararCuadre(state, 614, '2026-03-01', 'id-1');
    expect(c.cuenta.fechaSaldo).toBe('2026-02-28');
  });

  it('avisa de los movimientos con fecha futura, que seguirán sumando', () => {
    const conFuturos = baseState([...movs, mov('2026-09-01', -100)], cuenta);
    const c = prepararCuadre(conFuturos, 614, '2026-08-15', 'id-1');
    expect(c.movimientosFuturos).toBe(1);
    expect(calcularSaldo(c.cuenta, [c.movimiento!, ...conFuturos.movimientos])).toBeCloseTo(514, 2);
  });
});
