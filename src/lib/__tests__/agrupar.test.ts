import { describe, it, expect } from 'vitest';
import { claveComercio, reglaPorPalabra, proponerCategorias, construirImportacion, SIN_CLASIFICAR } from '../importacion/agrupar';
import type { Categoria, Movimiento } from '../storage/types';

let n = 0;
const mov = (concepto: string, categoria = SIN_CLASIFICAR, importe = -10): Movimiento => ({
  id: `m${++n}`, fecha: '2026-09-01', importe, concepto, categoria, fuente: 'import:extracto', hash: `${n}`,
});

describe('claveComercio', () => {
  it('agrupa el mismo comercio aunque el banco lo escriba distinto', () => {
    const claves = [
      'Pago en MERCADONA TORDERA',
      'Pago en MERCADONA AVDA. CATALUNYA',
      'Devolución Tarjeta MERCADONA MERCAT DEL FONDSTA COLOMA',
    ].map(c => claveComercio(c).clave);
    expect(new Set(claves)).toEqual(new Set(['mercadona']));
    expect(claveComercio('Pago en AMZN Mktp ES').clave).toBe(claveComercio('Devolución Tarjeta AMZN Mktp ES 800 279').clave);
    expect(claveComercio('Pago en Revolut**7698*').clave).toBe('revolut');
    expect(claveComercio('Pago en 8019 C.VERDI STA COLOMA').clave).toBe('verdi');
  });

  it('los Bizum y transferencias se agrupan por persona', () => {
    const a = claveComercio('Bizum enviado a DEMBA MBALLO SABALY Box');
    const b = claveComercio('Bizum enviado a DEMBA MBALLO SABALY Camiseta');
    const c = claveComercio('Bizum recibido de DEMBA MBALLO SABALY Sin concepto');
    expect(a.clave).toBe(b.clave);
    expect(a.clave).not.toBe(c.clave);
    expect(a.etiqueta).toBe('Bizum a Demba Mballo');
  });

  it('palabras genéricas se quedan con la siguiente', () => {
    expect(claveComercio('Pago en SANTA COLOMA - US').clave).toBe('santa coloma');
    expect(claveComercio('Pago en SANTA SUSANNA').clave).toBe('santa susanna');
  });

  it('traspasos internos y nóminas, un grupo cada uno', () => {
    expect(claveComercio('Traspaso interno recibido Movimiento ING').etiqueta).toBe('Traspaso de tus cuentas');
    expect(claveComercio('Traspaso interno recibido M').clave).toBe(claveComercio('Traspaso interno recibido Movimiento ING').clave);
    expect(claveComercio('Nomina recibida INDUSTRIA DE DISENO TEXTIL S.A.').etiqueta).toBe('Nómina');
  });
});

describe('reglaPorPalabra', () => {
  it('reconoce comercios habituales', () => {
    expect(reglaPorPalabra('COMPRA LIDL BLANES')?.id).toBe('alimentacion');
    expect(reglaPorPalabra('Recibo DIGI SPAIN TELECOM SL')?.id).toBe('hogar');
    expect(reglaPorPalabra('FARMACIA LOPEZ')?.id).toBe('salud');
    expect(reglaPorPalabra('Transferencia a Juan')).toBeNull();
  });
  it('gana la palabra que sale antes', () => {
    expect(reglaPorPalabra('Pago en AUCAT BAR VALLCARCA')?.id).toBe('transporte');
  });
});

describe('proponerCategorias', () => {
  const alimentacion: Categoria = { id: 'alimentacion', nombre: 'Alimentación', color: '#0f0', tipo: 'gasto' };
  const super_: Categoria = { id: 'super', nombre: 'Súper', color: '#0f0', tipo: 'gasto' };

  it('el historial manda sobre el banco', () => {
    const historial = [mov('Pago en MERCADONA OTRA', 'super')];
    const m = mov('Pago en MERCADONA TORDERA', 'alimentaci-n');
    const p = proponerCategorias({
      movimientos: [m], nombresBanco: new Map([['alimentaci-n', 'Alimentación']]),
      categorias: [alimentacion, super_], historial,
    });
    expect(p.asignacion[m.id]).toBe('super');
    expect(p.origen[m.id]).toBe('historial');
  });

  it('reutiliza tu categoría si el banco la llama igual, en vez de duplicarla', () => {
    const m = mov('Pago en MERCADONA', 'alimentaci-n');
    const p = proponerCategorias({
      movimientos: [m], nombresBanco: new Map([['alimentaci-n', 'Alimentación']]),
      categorias: [alimentacion], historial: [],
    });
    expect(p.asignacion[m.id]).toBe('alimentacion');
    expect(p.opciones.filter(o => o.nombre === 'Alimentación')).toHaveLength(1);
  });

  it('sin categoría del banco, tira de palabras clave; si no hay pista, sin clasificar', () => {
    const a = mov('COMPRA FARMACIA CENTRAL');
    const b = mov('Transferencia a Pepe');
    const p = proponerCategorias({ movimientos: [a, b], nombresBanco: new Map(), categorias: [], historial: [] });
    expect(p.asignacion[a.id]).toBe('salud');
    expect(p.origen[a.id]).toBe('palabra');
    expect(p.opciones.find(o => o.id === 'salud')?.nueva).toBe(true);
    expect(p.asignacion[b.id]).toBe(SIN_CLASIFICAR);
    expect(p.origen[b.id]).toBe('ninguno');
  });

  it('agrupa y ordena los grupos de mayor a menor', () => {
    const movs = [mov('Pago en LIDL A'), mov('Pago en DIA 1'), mov('Pago en LIDL B'), mov('Pago en LIDL C')];
    const p = proponerCategorias({ movimientos: movs, nombresBanco: new Map(), categorias: [], historial: [] });
    expect(p.grupos[0]).toMatchObject({ clave: 'lidl', etiqueta: 'Lidl' });
    expect(p.grupos[0].ids).toHaveLength(3);
    expect(p.grupos[0].total).toBe(-30);
  });
});

describe('construirImportacion', () => {
  it('aplica la asignación y solo crea las categorías nuevas que se usan', () => {
    const a = mov('COMPRA FARMACIA');
    const b = mov('Pago en LIDL');
    const p = proponerCategorias({ movimientos: [a, b], nombresBanco: new Map(), categorias: [], historial: [] });
    const r = construirImportacion(p.movimientos, { ...p.asignacion, [b.id]: 'salud' }, p.opciones);
    expect(r.movimientos.map(m => m.categoria)).toEqual(['salud', 'salud']);
    expect(r.nuevasCategorias.map(c => c.id)).toEqual(['salud']);
    expect(r.nuevasCategorias[0]).toMatchObject({ nombre: 'Salud', icono: 'heart', macro: 'fijo' });
  });
});
