import { describe, it, expect } from 'vitest';
import { migrate } from '../storage/storage';

describe('migrate', () => {
  it('migra un estado v1 hasta el esquema actual sin perder datos', () => {
    const legacy = {
      schemaVersion: 1,
      movimientos: [{ id: 'a', fecha: '2025-01-01', importe: -5, concepto: 'x', categoria: 'c', fuente: 'manual', hash: 'h' }],
      cuenta: { fechaSaldo: '2025-01-01', saldoActual: 100, banco: 'b' },
      savingsGoal: 500,
      savingsAcumulado: 100,
    };
    const s = migrate(legacy);
    expect(s.schemaVersion).toBe(4);
    expect(s.movimientos[0].enPresupuesto).toBe(true);
    expect(s.theme).toBe('dark');
    expect(s.hasOnboarded).toBe(true);
    expect(s.savingsMetas).toHaveLength(1);
    expect(s.planAnual.datos).toEqual({});
    expect(s.planAnual.escenario).toEqual({});
  });

  it('v3→v4: fusiona los grupos personalizados del plan en "variables"', () => {
    const v3 = {
      schemaVersion: 3,
      movimientos: [],
      planAnual: {
        grupos: [
          { id: 'fijos', nombre: 'Fijos', color: '#f00' },
          { id: 'grp-custom', nombre: 'Hijos', color: '#0f0' },
        ],
        datos: {
          '2026': [{ sueldo: 2000, grupos: { fijos: 800, 'grp-custom': 300, variables: 100 } }],
        },
      },
    };
    const s = migrate(v3);
    expect(s.schemaVersion).toBe(4);
    const enero = s.planAnual.datos['2026'][0];
    expect(enero.sueldo).toBe(2000);
    expect(enero.grupos.fijos).toBe(800);
    // 300 del grupo personalizado + 100 que ya había en variables
    expect(enero.grupos.variables).toBe(400);
    expect(enero.grupos['grp-custom']).toBeUndefined();
  });

  it('no revienta con un objeto vacío', () => {
    const s = migrate({});
    expect(s.schemaVersion).toBe(4);
    expect(Array.isArray(s.movimientos)).toBe(true);
    expect(s.planAnual.escenario).toEqual({});
  });
});
