import { describe, it, expect } from 'vitest';
import { generarCargosSuscripciones, totalMensual, totalAnual, totalIngresosMensual } from '../suscripciones/suscripciones';
import type { Suscripcion } from '../storage/types';

const base: Suscripcion = {
  id: 's1', nombre: 'Netflix', importe: 15, frecuencia: 'mensual',
  diaCobro: 2, categoria: 'ocio', activa: true, inicio: '2026-07-02',
};

describe('generarCargosSuscripciones (mensual)', () => {
  it('genera el cargo del día si ya llegó el día de cobro', () => {
    const r = generarCargosSuscripciones([base], '2026-07-02');
    expect(r.generados).toBe(1);
    expect(r.nuevosMovimientos[0].fecha).toBe('2026-07-02');
    expect(r.nuevosMovimientos[0].importe).toBe(-15);
    expect(r.suscripcionesActualizadas[0].ultimoCargo).toBe('2026-07');
  });

  it('es idempotente: no duplica en la misma fecha', () => {
    const r1 = generarCargosSuscripciones([base], '2026-07-02');
    const r2 = generarCargosSuscripciones(r1.suscripcionesActualizadas, '2026-07-02');
    expect(r2.generados).toBe(0);
  });

  it('si el día de cobro ya pasó este mes, espera al mes siguiente', () => {
    const dia1 = { ...base, diaCobro: 1 }; // inicio 2 jul, cobro día 1
    const r = generarCargosSuscripciones([dia1], '2026-07-02');
    expect(r.generados).toBe(0);
    const r2 = generarCargosSuscripciones(r.suscripcionesActualizadas, '2026-08-01');
    expect(r2.generados).toBe(1);
    expect(r2.nuevosMovimientos[0].fecha).toBe('2026-08-01');
  });

  it('limita el backfill a ~12 meses', () => {
    const vieja = { ...base, inicio: '2023-01-05', diaCobro: 5 };
    const r = generarCargosSuscripciones([vieja], '2026-07-02');
    expect(r.generados).toBeGreaterThanOrEqual(11);
    expect(r.generados).toBeLessThanOrEqual(13);
  });

  it('las pausadas no generan cargos', () => {
    const pausada = { ...base, activa: false };
    expect(generarCargosSuscripciones([pausada], '2026-07-02').generados).toBe(0);
  });
});

describe('generarCargosSuscripciones (anual)', () => {
  const anual: Suscripcion = { ...base, id: 's2', nombre: 'Prime', importe: 50, frecuencia: 'anual', inicio: '2024-03-10' };

  it('genera un cargo por aniversario, con backfill', () => {
    const r = generarCargosSuscripciones([anual], '2026-07-02');
    expect(r.nuevosMovimientos.map(m => m.fecha)).toEqual(['2024-03-10', '2025-03-10', '2026-03-10']);
  });

  it('respeta el 29 de febrero en años no bisiestos', () => {
    const feb29 = { ...anual, inicio: '2024-02-29' };
    const r = generarCargosSuscripciones([feb29], '2026-07-02');
    expect(r.nuevosMovimientos.map(m => m.fecha)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
  });
});

describe('ingresos recurrentes (esIngreso)', () => {
  const nomina: Suscripcion = { ...base, id: 's3', nombre: 'Nómina', importe: 1800, diaCobro: 25, inicio: '2026-06-01', esIngreso: true };

  it('genera movimientos positivos', () => {
    const r = generarCargosSuscripciones([nomina], '2026-06-25');
    expect(r.generados).toBe(1);
    expect(r.nuevosMovimientos[0].importe).toBe(1800);
  });

  it('los totales de gasto excluyen los ingresos, y viceversa', () => {
    const subs = [base, nomina];
    expect(totalMensual(subs)).toBe(15);
    expect(totalAnual(subs)).toBe(180);
    expect(totalIngresosMensual(subs)).toBe(1800);
  });
});
