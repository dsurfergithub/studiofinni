import { describe, it, expect } from 'vitest';
import { repartirPorPeriodo, aplicarDecisiones, Decision } from '../finmes/reparto';
import { derivarMeses, mesesParaCubrir, mesIdDeMovimiento } from '../finmes/finmes';
import { MesFinanciero, Movimiento } from '../storage/types';

const mov = (id: string, fecha: string, extra: Partial<Movimiento> = {}): Movimiento => ({
  id,
  fecha,
  importe: -10,
  concepto: `Mov ${id}`,
  categoria: 'compras',
  fuente: 'import:plantilla',
  hash: id,
  ...extra,
});

// Periodos anclados a la nómina del día 25: agosto natural cae a caballo de dos.
const MESES: MesFinanciero[] = [
  { id: 'mes-2026-08', nombre: 'Agosto 2026', clave: '2026-08', inicio: '2026-07-25', fin: '2026-08-24' },
  { id: 'mes-2026-09', nombre: 'Septiembre 2026', clave: '2026-09', inicio: '2026-08-25', fin: '2026-09-23' },
];

describe('repartirPorPeriodo', () => {
  it('no molesta si todo cae en el mismo periodo', () => {
    const movs = [mov('a', '2026-08-05'), mov('b', '2026-08-10')];
    expect(repartirPorPeriodo(movs, MESES)).toBeNull();
  });

  it('no molesta si no hay movimientos', () => {
    expect(repartirPorPeriodo([], MESES)).toBeNull();
  });

  it('separa el periodo mayoritario de los que se salen', () => {
    const movs = [
      mov('a', '2026-08-05'),
      mov('b', '2026-08-10'),
      mov('c', '2026-08-20'),
      mov('d', '2026-08-28'), // se sale: ya es del periodo de septiembre
    ];
    const r = repartirPorPeriodo(movs, MESES)!;
    expect(r.principal.mesId).toBe('mes-2026-08');
    expect(r.principal.movimientos).toHaveLength(3);
    expect(r.nFuera).toBe(1);
    expect(r.fuera).toHaveLength(1);
    expect(r.fuera[0].nombre).toBe('Septiembre 2026');
    expect(r.fuera[0].movimientos.map(m => m.id)).toEqual(['d']);
  });

  it('en empate gana el periodo más reciente', () => {
    const movs = [mov('a', '2026-08-05'), mov('b', '2026-08-28')];
    const r = repartirPorPeriodo(movs, MESES)!;
    expect(r.principal.mesId).toBe('mes-2026-09');
  });

  it('agrupa aparte los que no caen en ningún periodo', () => {
    const movs = [mov('a', '2026-08-05'), mov('b', '2030-01-01')];
    const r = repartirPorPeriodo(movs, MESES)!;
    const huerfanos = r.fuera.find(g => g.mesId === '');
    expect(huerfanos?.movimientos.map(m => m.id)).toEqual(['b']);
    expect(huerfanos?.nombre).toBe('Fuera de todo periodo');
  });

  it('respeta el pin (mesId) de un movimiento ya asignado a mano', () => {
    // 'b' cae en agosto por fecha, pero está clavado a septiembre: cuenta como "fuera".
    const movs = [
      mov('a', '2026-08-05'),
      mov('c', '2026-08-06'),
      mov('b', '2026-08-10', { mesId: 'mes-2026-09' }),
    ];
    const r = repartirPorPeriodo(movs, MESES)!;
    expect(r.principal.mesId).toBe('mes-2026-08');
    expect(r.fuera[0].movimientos.map(m => m.id)).toEqual(['b']);
  });
});

describe('aplicarDecisiones', () => {
  const movs = [mov('a', '2026-08-05'), mov('b', '2026-08-28'), mov('c', '2026-08-29')];

  it('sin decisiones no toca nada', () => {
    const out = aplicarDecisiones(movs, new Map(), 'mes-2026-08');
    expect(out).toHaveLength(3);
    expect(out.every(m => m.mesId === undefined)).toBe(true);
  });

  it('«mover» clava el periodo sin cambiar la fecha', () => {
    const d = new Map<string, Decision>([['b', 'mover']]);
    const out = aplicarDecisiones(movs, d, 'mes-2026-08');
    const b = out.find(m => m.id === 'b')!;
    expect(b.mesId).toBe('mes-2026-08');
    expect(b.fecha).toBe('2026-08-28');
    expect(mesIdDeMovimiento(b, MESES)).toBe('mes-2026-08');
  });

  it('«excluir» deja el movimiento fuera de la importación', () => {
    const d = new Map<string, Decision>([['b', 'excluir'], ['c', 'excluir']]);
    const out = aplicarDecisiones(movs, d, 'mes-2026-08');
    expect(out.map(m => m.id)).toEqual(['a']);
  });

  it('sin periodo destino, «mover» no rompe: se queda como estaba', () => {
    const d = new Map<string, Decision>([['b', 'mover']]);
    const out = aplicarDecisiones(movs, d, '');
    expect(out.find(m => m.id === 'b')!.mesId).toBeUndefined();
  });
});

describe('caso real: una plantilla de un mes natural con nómina a mitad de mes', () => {
  it('avisa del reparto y permite dejarlo todo en un solo periodo', () => {
    // El usuario ancla su periodo a la nómina del 15/08 y sube todo agosto.
    const meses = derivarMeses([
      { id: 'n1', fecha: '2026-08-15', importe: 1500, concepto: 'Nómina' },
    ]);
    const movs = ['2026-08-01', '2026-08-05', '2026-08-20', '2026-08-25', '2026-08-28'].map((f, i) =>
      mov(`m${i}`, f)
    );
    const fechas = movs.map(m => m.fecha);
    const todos = [
      ...meses,
      ...mesesParaCubrir(meses, fechas[0], fechas[fechas.length - 1]),
    ];

    const r = repartirPorPeriodo(movs, todos)!;
    // El periodo de la nómina del 15/08 se lleva 3; los del 1 y el 5 de agosto caen en
    // el periodo anterior (15/07–14/08), que la app llama «Julio 2026».
    expect(r.principal.nombre).toBe('Agosto 2026');
    expect(r.nFuera).toBe(2);
    expect(r.fuera[0].nombre).toBe('Julio 2026');

    const decisiones = new Map<string, Decision>(
      r.fuera.flatMap(g => g.movimientos.map(m => [m.id, 'mover' as Decision]))
    );
    const out = aplicarDecisiones(movs, decisiones, r.principal.mesId);
    expect(out).toHaveLength(5);
    expect(out.every(m => mesIdDeMovimiento(m, todos) === r.principal.mesId)).toBe(true);
    // Las fechas reales se conservan: lo que cambia es a qué periodo cuentan.
    expect(out.map(m => m.fecha)).toEqual(fechas);
  });
});
