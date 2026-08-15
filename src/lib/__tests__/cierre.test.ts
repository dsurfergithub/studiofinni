import { describe, it, expect } from 'vitest';
import { saldoAFecha, puedeCerrarse, mesesPendientesDeCierre, saldoInicialDeMes, prepararCierre } from '../cierre/cierre';
import { calcularSaldo } from '../saldo/cuadre';
import { AppState, CierreMes, MesFinanciero, Movimiento } from '../storage/types';

const mov = (id: string, fecha: string, importe: number): Movimiento =>
  ({ id, fecha, importe, concepto: 'x', categoria: 'c', fuente: 'manual', hash: id });

const ajuste = (id: string, fecha: string, importe: number): Movimiento =>
  ({ id, fecha, importe, concepto: 'Ajuste', categoria: 'ajuste-de-saldo', fuente: 'manual', hash: id });

const mes = (id: string, inicio: string, fin: string, nombre = id): MesFinanciero =>
  ({ id, nombre, clave: inicio.slice(0, 7), inicio, fin });

const estado = (movimientos: Movimiento[], cuenta: AppState['cuenta']): AppState =>
  ({ movimientos, categorias: [], cuenta, cierres: {} } as unknown as AppState);

const CUENTA = { banco: 'b', saldoActual: 1000, fechaSaldo: '2026-08-31' };

describe('saldoAFecha', () => {
  const movs = [mov('a', '2026-08-20', -100), mov('b', '2026-09-05', -50)];

  it('hacia adelante suma lo posterior al ancla', () => {
    expect(saldoAFecha(CUENTA, movs, '2026-09-10')).toBe(950);
  });

  it('hacia atrás deshace lo que pasó entre medias', () => {
    // El 19-ago aún no se había gastado el 20-ago: había 100 más.
    expect(saldoAFecha(CUENTA, movs, '2026-08-19')).toBe(1100);
  });

  it('en el propio día del ancla devuelve el ancla', () => {
    expect(saldoAFecha(CUENTA, movs, '2026-08-31')).toBe(1000);
  });
});

describe('los ajustes nunca mueven el saldo', () => {
  // La trampa: cerrar un mes anterior retrasa el ancla, y un ajuste viejo se quedaría
  // por delante de ella aplicando su corrección por segunda vez.
  const movs = [ajuste('aj', '2026-09-15', 996.45), mov('m', '2026-09-20', -30)];
  const cuenta = { banco: 'b', saldoActual: 614, fechaSaldo: '2026-09-15' };

  it('con el ancla en la fecha del ajuste, el saldo es el del banco', () => {
    expect(calcularSaldo(cuenta, movs)).toBe(584);
  });

  it('y al retroceder el ancla el ajuste sigue sin contar', () => {
    const anterior = { ...cuenta, saldoActual: 500, fechaSaldo: '2026-09-14' };
    expect(calcularSaldo(anterior, movs)).toBe(470); // 500 − 30, sin los 996,45
    expect(saldoAFecha(anterior, movs, '2026-09-30')).toBe(470);
  });
});

describe('qué se puede cerrar', () => {
  const agosto = mes('m-ago', '2026-08-01', '2026-08-31');
  const septiembre = mes('m-sep', '2026-09-01', '2026-09-30');

  it('solo los periodos ya terminados', () => {
    expect(puedeCerrarse(agosto, '2026-09-10', {})).toBe(true);
    expect(puedeCerrarse(septiembre, '2026-09-10', {})).toBe(false);
  });

  it('y solo una vez', () => {
    const cierres: Record<string, CierreMes> = { 'm-ago': { mesId: 'm-ago', saldoFinal: 1, fecha: '2026-08-31', cerradoEn: 0 } };
    expect(puedeCerrarse(agosto, '2026-09-10', cierres)).toBe(false);
  });

  it('los pendientes salen del más antiguo al más reciente', () => {
    const julio = mes('m-jul', '2026-07-01', '2026-07-31');
    const orden = mesesPendientesDeCierre([septiembre, agosto, julio], '2026-10-01', {});
    expect(orden.map(m => m.id)).toEqual(['m-jul', 'm-ago', 'm-sep']);
  });
});

describe('saldoInicialDeMes', () => {
  const julio = mes('m-jul', '2026-07-01', '2026-07-31');
  const agosto = mes('m-ago', '2026-08-01', '2026-08-31');
  const meses = [agosto, julio];

  it('es el saldo final del periodo anterior si está cerrado', () => {
    const cierres: Record<string, CierreMes> = { 'm-jul': { mesId: 'm-jul', saldoFinal: 742.5, fecha: '2026-07-31', cerradoEn: 0 } };
    expect(saldoInicialDeMes(agosto, meses, cierres)).toBe(742.5);
  });

  it('es null si el anterior no está cerrado: no inventamos una cifra', () => {
    expect(saldoInicialDeMes(agosto, meses, {})).toBeNull();
  });

  it('es null si no hay periodo anterior', () => {
    expect(saldoInicialDeMes(julio, meses, {})).toBeNull();
  });
});

describe('prepararCierre', () => {
  const agosto = mes('m-ago', '2026-08-01', '2026-08-31', 'Agosto 2026');
  // Ancla en 10-sep con 900; entre el 31-ago y el 10-sep se gastaron 40.
  const cuenta = { banco: 'b', saldoActual: 900, fechaSaldo: '2026-09-10' };
  const movs = [mov('a', '2026-09-05', -40)];
  const state = estado(movs, cuenta);

  it('compara contra el saldo del último día, no contra el de hoy', () => {
    const c = prepararCierre(state, agosto, 1000, 'id-1', 0);
    expect(c.saldoCalculado).toBe(940); // 900 + 40 deshechos
    expect(c.diferencia).toBe(60);
    expect(c.cuenta).toEqual({ banco: 'b', saldoActual: 1000, fechaSaldo: '2026-08-31' });
    expect(c.registro).toEqual({ mesId: 'm-ago', saldoFinal: 1000, fecha: '2026-08-31', cerradoEn: 0 });
  });

  it('el ajuste se fecha en el último día y se queda en ese mes', () => {
    const c = prepararCierre(state, agosto, 1000, 'id-1', 0);
    expect(c.movimiento?.fecha).toBe('2026-08-31');
    expect(c.movimiento?.mesId).toBe('m-ago');
    expect(c.movimiento?.enPresupuesto).toBe(false);
  });

  it('tras cerrar, el saldo de hoy vuelve a salir de la cifra confirmada', () => {
    const c = prepararCierre(state, agosto, 1000, 'id-1', 0);
    expect(calcularSaldo(c.cuenta, [c.movimiento!, ...movs])).toBe(960); // 1000 − 40
  });

  it('si cuadraba no hay ajuste', () => {
    const c = prepararCierre(state, agosto, 940, 'id-1', 0);
    expect(c.diferencia).toBe(0);
    expect(c.movimiento).toBeNull();
  });
});
