import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { parseExcelData } from '../excel/parser';
import { detectarNominas } from '../finmes/nominas';
import { derivarMeses } from '../finmes/finmes';
import { volcarExtracto } from '../importacion/aplicar';
import { getInitialState } from '../storage/storage';

// Extracto real de ING de casi dos años (nov-2024 a sep-2026) que aportó el usuario. No
// está en el repo porque lleva sus movimientos: se indica con FINNI_MUESTRA_ING y, si no
// está, el test se salta. Sirve de comprobación local, no de CI.
const MUESTRA = process.env.FINNI_MUESTRA_ING || '';

describe.skipIf(!MUESTRA || !existsSync(MUESTRA))('extracto histórico de ING', () => {
  it('lee las fechas, el saldo del último día y periodos que empiezan en la nómina', async () => {
    const r = await parseExcelData(readFileSync(MUESTRA, 'binary'));
    expect(r.movimientos).toHaveLength(1350);
    const fechas = r.movimientos.map(m => m.fecha).sort();
    expect(fechas[0]).toBe('2024-11-26');
    expect(fechas[fechas.length - 1]).toBe('2026-09-24');
    expect(r.fechaSaldo).toBe('2026-09-24');
    expect(r.saldoActual).toBe(24.49);

    const nominas = detectarNominas(r.movimientos);
    expect(nominas.every(n => /nomina/i.test(n.concepto))).toBe(true);
    // Sin paga extra: todas caen en la segunda quincena.
    expect(nominas.every(n => Number(n.fecha.slice(8, 10)) >= 20)).toBe(true);

    // Un periodo por mes, sin nombres repetidos.
    const nombres = derivarMeses(nominas).map(m => m.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);

    // Volcado completo: cada movimiento cae en exactamente un periodo.
    const inicial = getInitialState();
    const { cambios } = volcarExtracto(inicial, r.movimientos, [], r);
    const todos = [...derivarMeses(cambios.nominasAncla!), ...cambios.mesesPersonalizados!];
    const meses = Array.from(new Map(todos.map(m => [m.id, m])).values());
    for (const m of r.movimientos) {
      expect(meses.filter(p => m.fecha >= p.inicio && m.fecha <= p.fin)).toHaveLength(1);
    }
  });
});
