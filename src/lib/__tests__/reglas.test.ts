import { describe, it, expect } from 'vitest';
import { aplicaRegla, categoriaPorReglas, crearRegla, fusionarReglas, pendientesDeRegla } from '../categorias/reglas';
import { proponerCategorias, claveComercio } from '../importacion/agrupar';
import type { Categoria, Movimiento } from '../storage/types';

let n = 0;
const mov = (concepto: string, categoria = 'sin-clasificar'): Movimiento => ({
  id: `m${++n}`, fecha: '2026-09-01', importe: -10, concepto, categoria, fuente: 'import:extracto', hash: `${n}`,
});

describe('reglas de categorización', () => {
  it('aplica por texto contenido, sin tildes ni mayúsculas', () => {
    const r = crearRegla('  GALP ', 'transporte');
    expect(r.texto).toBe('galp');
    expect(aplicaRegla(r, 'Pago en GALP PALAFOLLS')).toBe(true);
    expect(aplicaRegla(r, 'Pago en REPSOL')).toBe(false);
  });

  it('aplica por clave de grupo (Bizum a una persona)', () => {
    const r = crearRegla(claveComercio('Bizum enviado a DEMBA MBALLO SABALY Box').clave, 'familia');
    expect(aplicaRegla(r, 'Bizum enviado a DEMBA MBALLO SABALY Camiseta')).toBe(true);
    expect(aplicaRegla(r, 'Bizum recibido de DEMBA MBALLO SABALY')).toBe(false);
  });

  it('gana la regla más específica', () => {
    const reglas = [crearRegla('amazon', 'compras'), crearRegla('amazon prime', 'ocio')];
    expect(categoriaPorReglas('AMAZON PRIME ES', reglas)).toBe('ocio');
    expect(categoriaPorReglas('AMAZON MKTP', reglas)).toBe('compras');
  });

  it('fusionar sustituye la regla del mismo texto', () => {
    const a = crearRegla('galp', 'transporte');
    const b = crearRegla('GALP', 'coche');
    expect(fusionarReglas([a], [b]).map(r => r.categoria)).toEqual(['coche']);
  });

  it('lista los movimientos que cambiarían al aplicarla', () => {
    const r = crearRegla('galp', 'transporte');
    const movs = [mov('Pago en GALP 1', 'transporte'), mov('Pago en GALP 2', 'otros'), mov('Pago en DIA')];
    expect(pendientesDeRegla(r, movs).map(m => m.concepto)).toEqual(['Pago en GALP 2']);
  });

  it('al importar, la regla manda sobre el banco y el historial', () => {
    const cats: Categoria[] = [
      { id: 'transporte', nombre: 'Transporte', color: '#000', tipo: 'gasto' },
      { id: 'otros', nombre: 'Otros gastos', color: '#000', tipo: 'gasto' },
    ];
    const m = mov('Pago en GALP PALAFOLLS', 'otros');
    const p = proponerCategorias({
      movimientos: [m], nombresBanco: new Map([['otros', 'Otros gastos']]), categorias: cats,
      historial: [mov('Pago en GALP X', 'otros')], reglas: [crearRegla('galp', 'transporte')],
    });
    expect(p.asignacion[m.id]).toBe('transporte');
    expect(p.origen[m.id]).toBe('regla');
  });
});
