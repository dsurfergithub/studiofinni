import { describe, it, expect } from 'vitest';
import { sugerirCategoria, normalizarConcepto } from '../categorias/sugerencias';
import type { Movimiento } from '../storage/types';

const mov = (concepto: string, categoria: string): Movimiento => ({
  id: concepto, fecha: '2026-01-01', importe: -10, concepto, categoria,
  fuente: 'manual', hash: concepto,
});

describe('normalizarConcepto', () => {
  it('quita tildes, mayúsculas y espacios repetidos', () => {
    expect(normalizarConcepto('  COMPRA   Alimentación ')).toBe('compra alimentacion');
  });
});

describe('sugerirCategoria', () => {
  const historial = [
    mov('COMPRA MERCADONA VALENCIA', 'alimentacion'),
    mov('Compra Mercadona', 'alimentacion'),
    mov('MERCADONA', 'alimentacion'),
    mov('Gasolinera Repsol', 'transporte'),
    mov('algo raro', 'sin-clasificar'),
  ];

  it('sugiere por coincidencia parcial del concepto', () => {
    expect(sugerirCategoria('mercadona', historial)).toBe('alimentacion');
    expect(sugerirCategoria('Compra Mercadona Ruzafa', historial)).toBe('alimentacion');
  });

  it('no sugiere nada con conceptos muy cortos o sin historial parecido', () => {
    expect(sugerirCategoria('ab', historial)).toBeNull();
    expect(sugerirCategoria('cine yelmo', historial)).toBeNull();
  });

  it('ignora los movimientos sin clasificar como fuente de votos', () => {
    expect(sugerirCategoria('algo raro', historial)).toBeNull();
  });
});
