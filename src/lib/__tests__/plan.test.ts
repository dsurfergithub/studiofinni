import { describe, it, expect } from 'vitest';
import { realDelAnio, macroDeCategoria, columnaDeMacro, PLAN_COLUMNAS } from '../plan/plan';
import type { Categoria, Movimiento } from '../storage/types';

const categorias: Categoria[] = [
  { id: 'hogar', nombre: 'Hogar', color: '#000', tipo: 'gasto', macro: 'fijo' },
  { id: 'ocio', nombre: 'Ocio', color: '#000', tipo: 'gasto', macro: 'variable' },
  { id: 'fondos', nombre: 'Fondos', color: '#000', tipo: 'gasto', macro: 'inversion' },
  { id: 'antigua', nombre: 'Sin macro', color: '#000', tipo: 'gasto' },
];

const mov = (fecha: string, importe: number, categoria: string): Movimiento => ({
  id: `${fecha}-${categoria}`, fecha, importe, categoria,
  concepto: 'x', fuente: 'manual', hash: `${fecha}-${categoria}`,
});

describe('macroDeCategoria / columnaDeMacro', () => {
  it('sin macro asignado cuenta como variable', () => {
    expect(macroDeCategoria(categorias[3])).toBe('variable');
    expect(macroDeCategoria(undefined)).toBe('variable');
  });

  it('cada macro tiene su columna en el plan', () => {
    expect(columnaDeMacro('fijo').id).toBe('fijos');
    expect(columnaDeMacro('variable').id).toBe('variables');
    expect(columnaDeMacro('inversion').id).toBe('inversion');
    expect(PLAN_COLUMNAS).toHaveLength(3);
  });
});

describe('realDelAnio', () => {
  const movimientos = [
    mov('2026-01-25', 2000, 'nomina'),      // ingreso enero
    mov('2026-01-05', -800, 'hogar'),       // fijo enero
    mov('2026-01-10', -150, 'ocio'),        // variable enero
    mov('2026-01-15', -100, 'fondos'),      // inversión enero
    mov('2026-01-20', -50, 'antigua'),      // sin macro → variable
    mov('2026-03-05', -60, 'ocio'),         // marzo
    mov('2025-12-31', -999, 'ocio'),        // otro año: fuera
  ];

  it('agrega ingresos y gastos por mes natural y macro-grupo', () => {
    const filas = realDelAnio(movimientos, categorias, '2026');
    expect(filas).toHaveLength(12);
    expect(filas[0].sueldo).toBe(2000);
    expect(filas[0].grupos.fijos).toBe(800);
    expect(filas[0].grupos.variables).toBe(200); // 150 ocio + 50 sin macro
    expect(filas[0].grupos.inversion).toBe(100);
    expect(filas[2].grupos.variables).toBe(60);
  });

  it('ignora movimientos de otros años', () => {
    const filas = realDelAnio(movimientos, categorias, '2026');
    const totalVariables = filas.reduce((a, f) => a + (f.grupos.variables || 0), 0);
    expect(totalVariables).toBe(260);
  });
});
