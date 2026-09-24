import { describe, it, expect } from 'vitest';
import { detectarNominas, quitarPeriodosSolapados } from '../finmes/nominas';
import type { MesFinanciero, Movimiento } from '../storage/types';

let n = 0;
const mov = (fecha: string, importe: number, concepto: string, categoria = 'x'): Movimiento => ({
  id: `m${++n}`, fecha, importe, concepto, categoria, fuente: 'import:extracto', hash: `${n}`,
});

describe('detectarNominas', () => {
  it('prefiere la nómina aunque un traspaso sea más grande', () => {
    const r = detectarNominas([
      mov('2025-08-29', 1453.26, 'Nomina recibida INDUSTRIA DE DISENO TEXTIL S.A.'),
      mov('2025-09-17', 2000, 'Transferencia recibida de DABA Transferencia desde MyInvestor'),
      mov('2025-09-30', 1500, 'Nomina recibida INDUSTRIA DE DISENO TEXTIL S.A.'),
      mov('2025-10-05', 350, 'Traspaso interno recibido'),
    ]);
    expect(r.map(a => a.fecha)).toEqual(['2025-08-29', '2025-09-30']);
  });

  it('con paga extra se queda con la del día de cobro habitual', () => {
    const r = detectarNominas([
      mov('2025-10-31', 1967.64, 'Nomina recibida EMPRESA'),
      mov('2025-11-28', 1788.33, 'Nomina recibida EMPRESA'),
      mov('2025-12-13', 1985.84, 'Nomina recibida EMPRESA'),
      mov('2025-12-30', 1700, 'Nomina recibida EMPRESA'),
      mov('2026-01-30', 1759.33, 'Nomina recibida EMPRESA'),
    ]);
    expect(r.map(a => a.fecha)).toEqual(['2025-10-31', '2025-11-28', '2025-12-30', '2026-01-30']);
  });

  it('reconoce la nómina por el nombre de la categoría', () => {
    const cats: Record<string, string> = { nom: 'Nómina y otras prestaciones' };
    const r = detectarNominas([
      mov('2026-01-27', 1200, 'EMPRESA SL', 'nom'),
      mov('2026-01-10', 3000, 'Venta coche', 'otros'),
      mov('2026-02-26', 1200, 'EMPRESA SL', 'nom'),
    ], id => cats[id] || id);
    expect(r.map(a => a.fecha)).toEqual(['2026-01-27', '2026-02-26']);
  });

  it('sin nada que parezca nómina, el ingreso más grande que no sea un traspaso', () => {
    const r = detectarNominas([
      mov('2026-01-05', 900, 'Traspaso interno recibido'),
      mov('2026-01-20', 800, 'Transferencia de CLIENTE'),
      mov('2026-02-20', 150, 'Bizum recibido de PEPE'),
    ]);
    expect(r.map(a => a.fecha)).toEqual(['2026-01-20']);
  });

  it('usa el id del movimiento: el periodo conserva su id al reimportar', () => {
    const m = mov('2026-03-27', 1500, 'NOMINA');
    expect(detectarNominas([m])[0]).toMatchObject({ id: m.id, movimientoId: m.id });
  });
});

describe('quitarPeriodosSolapados', () => {
  const mes = (id: string, inicio: string, fin: string): MesFinanciero => ({ id, nombre: id, clave: inicio.slice(0, 7), inicio, fin });
  it('quita los meses del 1 al 31 que pisan periodos de nómina y respeta el resto', () => {
    const derivados = [mes('mes-a', '2026-08-28', '2026-09-26')];
    const custom = [
      mes('mes-2026-09', '2026-09-01', '2026-09-30'), // pisa: fuera
      mes('mes-2026-10', '2026-09-27', '2026-10-26'), // no pisa: se queda
      mes('mes-a', '2026-08-27', '2026-09-26'),       // edición del derivado: se queda
    ];
    expect(quitarPeriodosSolapados(custom, derivados).map(m => m.id)).toEqual(['mes-2026-10', 'mes-a']);
  });
});
