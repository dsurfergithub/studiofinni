import { describe, it, expect } from 'vitest';
import {
  mesesConDatos, mismoMesAnioAnterior, totalesDe, compararCategorias, variacion, serieAnual, acumuladoHasta, aniosConDatos, nombreMes,
} from '../insights/comparar';
import type { Movimiento } from '../storage/types';

let n = 0;
const mov = (fecha: string, importe: number, categoria = 'super'): Movimiento => ({
  id: `m${++n}`, fecha, importe, concepto: 'x', categoria, fuente: 'manual', hash: `${n}`,
});

const movs = [
  mov('2025-01-10', -100), mov('2025-01-15', -50, 'ocio'), mov('2025-01-31', 1500, 'nomina'),
  mov('2025-09-10', -80),
  mov('2026-01-05', -150), mov('2026-01-20', -20, 'ocio'), mov('2026-01-30', 1600, 'nomina'),
  mov('2026-01-31', 300, 'ajuste-de-saldo'), // no cuenta
  mov('2026-03-02', -40),
];

describe('comparativas por mes natural', () => {
  it('lista meses y años con datos, del más reciente al más antiguo', () => {
    expect(mesesConDatos(movs)).toEqual(['2026-03', '2026-01', '2025-09', '2025-01']);
    expect(aniosConDatos(movs)).toEqual([2026, 2025]);
    expect(mismoMesAnioAnterior('2026-01')).toBe('2025-01');
    expect(nombreMes('2026-01')).toBe('Enero 2026');
  });

  it('totales sin los ajustes de saldo', () => {
    expect(totalesDe(movs, '2026-01')).toEqual({ ingresos: 1600, gastos: 170, ahorro: 1430, movimientos: 3 });
  });

  it('enero 2026 contra enero 2025, por categoría', () => {
    const filas = compararCategorias(movs, '2026-01', '2025-01');
    expect(filas).toEqual([
      { id: 'super', a: 150, b: 100, diff: 50 },
      { id: 'ocio', a: 20, b: 50, diff: -30 },
    ]);
    expect(variacion(170, 150)).toBeCloseTo(0.1333, 3);
    expect(variacion(10, 0)).toBeNull();
  });

  it('serie anual: null donde no hay datos para que la línea se corte', () => {
    const serie = serieAnual(movs, [2026, 2025], 'gastos');
    expect(serie[0]).toEqual({ mes: 'Ene', '2026': 170, '2025': 150 });
    expect(serie[1]).toEqual({ mes: 'Feb', '2026': null, '2025': null });
    expect(serie[8]).toEqual({ mes: 'Sep', '2026': null, '2025': 80 });
  });

  it('acumulado hasta un mes, para comparar años en igualdad', () => {
    expect(acumuladoHasta(movs, 2025, 3).gastos).toBe(150);
    expect(acumuladoHasta(movs, 2026, 3).gastos).toBe(210);
  });
});
