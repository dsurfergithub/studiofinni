import { describe, it, expect } from 'vitest';
import { movimientosACsv } from '../export/csv';
import type { Categoria, Movimiento } from '../storage/types';

describe('movimientosACsv', () => {
  const categorias: Categoria[] = [
    { id: 'ocio', nombre: 'Ocio', color: '#000', tipo: 'gasto' },
  ];
  const movs: Movimiento[] = [
    { id: '1', fecha: '2026-07-01', importe: -12.5, concepto: 'Cine; palomitas', categoria: 'ocio', fuente: 'manual', hash: 'h1', notas: 'con "amigos"' },
    { id: '2', fecha: '2026-07-02', importe: 1800, concepto: 'Nómina', categoria: 'nomina', fuente: 'suscripcion', hash: 'h2' },
  ];

  it('separa con ; y usa coma decimal (Excel es-ES)', () => {
    const csv = movimientosACsv(movs, categorias);
    const lineas = csv.split('\n');
    expect(lineas[0]).toContain('Fecha;Concepto;Categoría');
    expect(lineas[1]).toContain('-12,50');
    expect(lineas[2]).toContain('1800,00');
  });

  it('escapa campos con ; o comillas y marca el origen', () => {
    const csv = movimientosACsv(movs, categorias);
    expect(csv).toContain('"Cine; palomitas"');
    expect(csv).toContain('"con ""amigos"""');
    expect(csv).toContain('Recurrente');
    expect(csv).toContain('Sin clasificar'); // categoría desconocida
  });

  it('empieza con BOM para que Excel detecte UTF-8', () => {
    expect(movimientosACsv(movs, categorias).charCodeAt(0)).toBe(0xfeff);
  });
});
