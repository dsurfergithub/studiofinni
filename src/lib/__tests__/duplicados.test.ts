import { describe, it, expect } from 'vitest';
import { buscarDuplicados, idsSobrantes, movimientoAConservar } from '../duplicados/duplicados';
import { Movimiento } from '../storage/types';

const mov = (id: string, fecha: string, importe: number, concepto: string, fuente: Movimiento['fuente'] = 'manual'): Movimiento =>
  ({ id, fecha, importe, concepto, categoria: 'c', fuente, hash: id });

describe('buscarDuplicados', () => {
  it('pilla el mismo gasto a mano y luego importado aunque el concepto no coincida', () => {
    const movs = [
      mov('a', '2026-08-01', -600, 'Alquiler'),
      mov('b', '2026-08-02', -600, 'Transferencias', 'import:plantilla'),
    ];
    const [g] = buscarDuplicados(movs);
    expect(g.motivo).toBe('origen-distinto');
    expect(g.movimientos).toHaveLength(2);
    expect(g.importeSobrante).toBe(600);
  });

  it('NO marca varios cobros del mismo importe y día venidos del mismo import', () => {
    // Cinco bizums de 19 € en una tarde son cinco bizums, no un duplicado.
    const movs = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      mov(id, '2025-07-06', 19, `Bizum de persona ${i}`, 'import:caixabank'));
    expect(buscarDuplicados(movs)).toEqual([]);
  });

  it('NO marca un gasto recurrente del mismo origen en días distintos', () => {
    const movs = [
      mov('a', '2026-07-15', -20, 'Gasolina'),
      mov('b', '2026-07-28', -20, 'Gasolina'),
    ];
    expect(buscarDuplicados(movs)).toEqual([]);
  });

  it('marca el doble tecleo: dos apuntes a mano, mismo día y mismo concepto', () => {
    const movs = [
      mov('a', '2026-07-15', -20, 'Gasolina'),
      mov('b', '2026-07-15', -20, 'gasolina  '),
    ];
    const [g] = buscarDuplicados(movs);
    expect(g.motivo).toBe('doble-tecleo');
  });

  it('respeta la ventana de días: fuera de ella no agrupa', () => {
    const movs = [
      mov('a', '2026-07-01', -50, 'Algo'),
      mov('b', '2026-07-10', -50, 'Otra cosa', 'import:plantilla'),
    ];
    expect(buscarDuplicados(movs)).toEqual([]);
    expect(buscarDuplicados(movs, 30)).toHaveLength(1);
  });

  it('ignora los ajustes de saldo', () => {
    const aj = (id: string, fecha: string): Movimiento =>
      ({ id, fecha, importe: 100, concepto: 'Ajuste', categoria: 'ajuste-de-saldo', fuente: 'manual', hash: id });
    expect(buscarDuplicados([aj('a', '2026-08-01'), aj('b', '2026-08-02')])).toEqual([]);
  });

  it('ordena por dinero en juego, de mayor a menor', () => {
    const movs = [
      mov('a', '2026-08-01', -10, 'x'), mov('b', '2026-08-01', -10, 'y', 'import:plantilla'),
      mov('c', '2026-08-01', -500, 'z'), mov('d', '2026-08-01', -500, 'w', 'import:plantilla'),
    ];
    expect(buscarDuplicados(movs).map(g => g.importe)).toEqual([-500, -10]);
  });
});

describe('a cuál quedarse', () => {
  it('manda el del banco sobre el tecleado a mano', () => {
    const movs = [
      mov('a', '2026-08-01', -250, 'h'),
      mov('b', '2026-08-01', -250, 'Gasto Bizum', 'import:plantilla'),
    ];
    const [g] = buscarDuplicados(movs);
    expect(movimientoAConservar(g).id).toBe('b');
    expect(idsSobrantes(g)).toEqual(['a']);
  });

  it('a igualdad de origen, se queda el más antiguo', () => {
    const movs = [
      mov('a', '2026-08-02', -30, 'x', 'import:plantilla'),
      mov('b', '2026-08-01', -30, 'y'),
      mov('c', '2026-08-01', -30, 'z', 'import:plantilla'),
    ];
    const [g] = buscarDuplicados(movs);
    expect(movimientoAConservar(g).id).toBe('c');
    expect(idsSobrantes(g).sort()).toEqual(['a', 'b']);
  });
});
