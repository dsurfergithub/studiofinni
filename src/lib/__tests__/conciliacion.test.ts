import { describe, it, expect } from 'vitest';
import { conciliar, puedeSerElMismo } from '../conciliacion/conciliacion';
import { Movimiento } from '../storage/types';

const mov = (id: string, fecha: string, importe: number, concepto: string, fuente: Movimiento['fuente'] = 'manual'): Movimiento =>
  ({ id, fecha, importe, concepto, categoria: 'c', fuente, hash: id });

const bank = (id: string, fecha: string, importe: number, concepto: string) =>
  mov(id, fecha, importe, concepto, 'import:caixabank');

describe('conciliar', () => {
  it('casa por importe y fecha aunque el concepto no se parezca en nada', () => {
    const app = [mov('a', '2026-08-01', -600, 'Alquiler')];
    const banco = [bank('b', '2026-08-02', -600, 'TRANSFERENCIA A INMOBILIARIA')];
    const r = conciliar(app, banco);
    expect(r.casados).toHaveLength(1);
    expect(r.casados[0].desfase).toBe(1);
    expect(r.faltanEnApp).toEqual([]);
    expect(r.sobranEnApp).toEqual([]);
  });

  it('saca la nómina que el banco tiene y tú no apuntaste', () => {
    const app = [mov('a', '2026-07-20', -50, 'Compra')];
    const banco = [bank('b', '2026-07-20', -50, 'COMPRA'), bank('c', '2026-07-25', 1800, 'NOMINA')];
    const r = conciliar(app, banco);
    expect(r.faltanEnApp.map(m => m.concepto)).toEqual(['NOMINA']);
    expect(r.totalFalta).toBe(1800);
    expect(r.descuadre).toBe(1800);
  });

  it('saca lo apuntado que el banco no tiene', () => {
    const app = [mov('a', '2026-07-20', -50, 'Compra'), mov('b', '2026-07-21', -30, 'Duplicado')];
    const banco = [bank('c', '2026-07-20', -50, 'COMPRA'), bank('d', '2026-07-31', -10, 'OTRA')];
    const r = conciliar(app, banco);
    expect(r.sobranEnApp.map(m => m.concepto)).toEqual(['Duplicado']);
    expect(r.totalSobra).toBe(-30);
    expect(r.descuadre).toBe(20); // faltan −10, sobran −30
  });

  it('un apunte justo fuera del extracto no se acusa: el extracto no llega ahí', () => {
    // El de julio queda fuera del rango [01-ago, 05-ago]: puede estar en el extracto
    // del mes anterior, así que no hay nada que reprocharle.
    const app = [mov('fuera', '2026-07-31', -30, 'De julio')];
    const banco = [bank('b', '2026-08-01', -50, 'X'), bank('c', '2026-08-05', -20, 'Y')];
    const r = conciliar(app, banco);
    expect(r.sobranEnApp).toEqual([]);
    expect(r.faltanEnApp).toHaveLength(2);
  });

  it('cada apunte se casa una sola vez: tres cobros iguales exigen tres apuntes', () => {
    const app = [mov('a', '2026-07-06', 19, 'Bizum'), mov('b', '2026-07-06', 19, 'Bizum')];
    const banco = ['x', 'y', 'z'].map((id, i) => bank(id, '2026-07-06', 19, `BIZUM ${i}`));
    const r = conciliar(app, banco);
    expect(r.casados).toHaveLength(2);
    expect(r.faltanEnApp).toHaveLength(1);
    expect(r.sobranEnApp).toEqual([]);
  });

  it('la fecha exacta gana la pareja antes de que nadie tire de la ventana', () => {
    const app = [mov('lejos', '2026-07-18', -40, 'A'), mov('exacto', '2026-07-20', -40, 'B')];
    const banco = [bank('b1', '2026-07-20', -40, 'X'), bank('b2', '2026-07-18', -40, 'Y')];
    const r = conciliar(app, banco);
    expect(r.casados).toHaveLength(2);
    expect(r.faltanEnApp).toEqual([]);
    const porBanco = new Map(r.casados.map(p => [p.banco.id, p.app.id]));
    expect(porBanco.get('b1')).toBe('exacto');
    expect(porBanco.get('b2')).toBe('lejos');
  });

  it('no juzga lo que cae fuera del rango del extracto', () => {
    const app = [mov('viejo', '2026-01-01', -99, 'De enero'), mov('nuevo', '2026-12-01', -99, 'De diciembre')];
    const banco = [bank('b', '2026-07-20', -50, 'COMPRA')];
    const r = conciliar(app, banco);
    expect(r.desde).toBe('2026-07-20');
    expect(r.sobranEnApp).toEqual([]);
    expect(r.faltanEnApp).toHaveLength(1);
  });

  it('ignora los ajustes de saldo: el banco nunca los va a tener', () => {
    const ajuste: Movimiento = { id: 'aj', fecha: '2026-07-20', importe: 996.45, concepto: 'Ajuste', categoria: 'ajuste-de-saldo', fuente: 'manual', hash: 'aj' };
    const r = conciliar([ajuste], [bank('b', '2026-07-20', -50, 'COMPRA')]);
    expect(r.sobranEnApp).toEqual([]);
  });

  it('a igualdad de desfase, la pareja se la lleva el importado y sobra el tecleado', () => {
    const app = [mov('mano', '2026-08-01', -250, 'h'), mov('imp', '2026-08-01', -250, 'Gasto Bizum', 'import:plantilla')];
    const banco = [bank('b', '2026-08-01', -250, 'GASTO BIZUM'), bank('c', '2026-08-05', -1, 'OTRA')];
    const r = conciliar(app, banco);
    expect(r.casados[0].app.id).toBe('imp');
    expect(r.sobranEnApp.map(m => m.id)).toEqual(['mano']);
  });

  it('avisa cuando el mismo importe sale a la vez en las dos listas', () => {
    // La nomina apuntada el 1 y cobrada el 5: 4 días, fuera de la ventana.
    const app = [mov('a', '2026-08-01', 1813.12, 'Nomina')];
    const banco = [bank('b', '2026-08-05', 1813.12, 'NOMINA'), bank('c', '2026-08-01', -30, 'OTRA')];
    const r = conciliar(app, banco);
    expect(r.faltanEnApp.map(m => m.importe)).toContain(1813.12);
    expect(r.sobranEnApp.map(m => m.importe)).toContain(1813.12);
    expect(puedeSerElMismo(r, r.faltanEnApp.find(m => m.importe === 1813.12)!)).toBe(true);
    expect(puedeSerElMismo(r, r.faltanEnApp.find(m => m.importe === -30)!)).toBe(false);
  });

  it('sin extracto no dice nada', () => {
    const r = conciliar([mov('a', '2026-07-20', -50, 'x')], []);
    expect(r).toMatchObject({ desde: '', casados: [], sobranEnApp: [], faltanEnApp: [], descuadre: 0 });
  });
});
