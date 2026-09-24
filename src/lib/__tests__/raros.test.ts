import { describe, it, expect } from 'vitest';
import { detectarGastosRaros } from '../insights/raros';
import type { MesFinanciero, Movimiento } from '../storage/types';

let n = 0;
const mov = (fecha: string, importe: number, categoria: string): Movimiento => ({
  id: `m${++n}`, fecha, importe, concepto: 'x', categoria, fuente: 'manual', hash: `${n}`,
});
const mes = (clave: string): MesFinanciero => ({ id: clave, nombre: clave, clave, inicio: `${clave}-01`, fin: `${clave}-28` });
const meses = ['2026-05', '2026-06', '2026-07', '2026-08'].map(mes);

describe('detectarGastosRaros', () => {
  const base = [
    mov('2026-05-10', -100, 'compras'), mov('2026-06-10', -120, 'compras'), mov('2026-07-10', -80, 'compras'),
    mov('2026-05-10', -300, 'super'), mov('2026-06-10', -310, 'super'), mov('2026-07-10', -290, 'super'),
  ];

  it('avisa de lo que pasa claramente de la media y no de lo normal', () => {
    const r = detectarGastosRaros([...base, mov('2026-08-05', -250, 'compras'), mov('2026-08-05', -320, 'super')], meses, meses[3], new Set());
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ categoria: 'compras', actual: 250, media: 100, exceso: 150 });
    expect(r[0].variacion).toBeCloseTo(1.5);
  });

  it('una categoría nueva solo avisa si es un gasto gordo', () => {
    expect(detectarGastosRaros([...base, mov('2026-08-05', -40, 'viajes')], meses, meses[3], new Set())).toEqual([]);
    const r = detectarGastosRaros([...base, mov('2026-08-05', -600, 'viajes')], meses, meses[3], new Set());
    expect(r[0]).toMatchObject({ categoria: 'viajes', variacion: null });
  });

  it('ignora las categorías fuera del análisis y exige historial', () => {
    const movs = [...base, mov('2026-08-05', -900, 'traspasos')];
    expect(detectarGastosRaros(movs, meses, meses[3], new Set(['traspasos']))).toEqual([]);
    expect(detectarGastosRaros(movs, meses, meses[1], new Set())).toEqual([]); // solo 1 periodo previo
  });
});
