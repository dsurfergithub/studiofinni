import { describe, it, expect } from 'vitest';
import { volcarExtracto } from '../importacion/aplicar';
import { getInitialState } from '../storage/storage';
import { derivarMeses } from '../finmes/finmes';
import type { AppState, MesFinanciero, Movimiento } from '../storage/types';

let n = 0;
const mov = (fecha: string, importe: number, concepto: string): Movimiento => ({
  id: `m${++n}`, fecha, importe, concepto, categoria: 'x', fuente: 'import:extracto', hash: `${n}`,
});

/** Todos los periodos activos, como los calcula la app. */
const activos = (s: AppState): MesFinanciero[] => {
  const all = [...derivarMeses(s.nominasAncla), ...s.mesesPersonalizados];
  return Array.from(new Map(all.map(m => [m.id, m])).values());
};

describe('volcarExtracto', () => {
  const extracto = [
    mov('2026-06-20', -30, 'Pago en LIDL'),           // antes de la primera nómina
    mov('2026-06-27', 1700, 'Nomina recibida EMPRESA'),
    mov('2026-07-10', 2500, 'Traspaso interno recibido'),
    mov('2026-07-31', 1800, 'Nomina recibida EMPRESA'),
    mov('2026-08-05', -12, 'Pago en DIA'),
  ];

  it('periodos de nómina a nómina, sin huecos ni solapes con los del 1 al 31', () => {
    const inicial: AppState = {
      ...getInitialState(),
      // Empezó "desde cero": agosto natural ya existía como periodo personalizado.
      mesesPersonalizados: [{ id: 'mes-2026-08', nombre: 'Agosto 2026', clave: '2026-08', inicio: '2026-08-01', fin: '2026-08-31' }],
    };
    const { cambios, mesDestino } = volcarExtracto(inicial, extracto, [], { saldoActual: 500, fechaSaldo: '2026-08-05' });
    const s = { ...inicial, ...cambios } as AppState;

    expect(s.nominasAncla.map(a => a.fecha)).toEqual(['2026-06-27', '2026-07-31']);
    const meses = activos(s);
    // Cada movimiento, en exactamente un periodo.
    for (const m of s.movimientos) {
      expect(meses.filter(p => m.fecha >= p.inicio && m.fecha <= p.fin)).toHaveLength(1);
    }
    expect(meses.find(p => p.id === mesDestino)!.inicio).toBe('2026-07-31');
    expect(s.cuenta).toMatchObject({ saldoActual: 500, fechaSaldo: '2026-08-05' });
  });

  it('un extracto más viejo no pisa el saldo', () => {
    const inicial: AppState = { ...getInitialState(), cuenta: { banco: '', saldoActual: 900, fechaSaldo: '2026-09-01' } };
    const { cambios } = volcarExtracto(inicial, extracto, [], { saldoActual: 500, fechaSaldo: '2026-08-05' });
    expect(cambios.cuenta).toBeUndefined();
  });
});
