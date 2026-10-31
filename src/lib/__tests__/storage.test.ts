import { describe, it, expect, vi } from 'vitest';
import { migrate, saveState, maybeWeeklyBackup, getInitialState } from '../storage/storage';

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
    expect(s.schemaVersion).toBe(6);
    expect(s.cierres).toEqual({});
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
    expect(s.schemaVersion).toBe(6);
    const enero = s.planAnual.datos['2026'][0];
    expect(enero.sueldo).toBe(2000);
    expect(enero.grupos.fijos).toBe(800);
    // 300 del grupo personalizado + 100 que ya había en variables
    expect(enero.grupos.variables).toBe(400);
    expect(enero.grupos['grp-custom']).toBeUndefined();
  });

  it('v4→v5: estrena los cierres de mes vacíos, sin inventar saldos hacia atrás', () => {
    const s = migrate({ schemaVersion: 4, movimientos: [], mesesPersonalizados: [{ id: 'm-jul', nombre: 'Julio', clave: '2026-07', inicio: '2026-07-01', fin: '2026-07-31' }] });
    expect(s.schemaVersion).toBe(6);
    expect(s.cierres).toEqual({});
    expect(s.mesesPersonalizados).toHaveLength(1);
  });

  it('conserva los cierres que ya existían', () => {
    const cierre = { mesId: 'm-jul', saldoFinal: 742.5, fecha: '2026-07-31', cerradoEn: 123 };
    const s = migrate({ schemaVersion: 5, movimientos: [], cierres: { 'm-jul': cierre } });
    expect(s.cierres['m-jul']).toEqual(cierre);
  });

  it('no revienta con un objeto vacío', () => {
    const s = migrate({});
    expect(s.schemaVersion).toBe(6);
    expect(Array.isArray(s.movimientos)).toBe(true);
    expect(s.cierres).toEqual({});
    expect(s.planAnual.escenario).toEqual({});
  });
});

describe('migración a v6', () => {
  it('añade reglas vacías y saca del análisis las categorías de traspasos', () => {
    const s = migrate({
      schemaVersion: 5,
      movimientos: [],
      categorias: [
        { id: 'mov-excl', nombre: 'Movimientos excluidos', color: '#000', tipo: 'ambos' },
        { id: 'ali', nombre: 'Alimentación', color: '#000', tipo: 'gasto' },
        { id: 'tras', nombre: 'Traspasos', color: '#000', tipo: 'ambos', excluirDeAnalisis: false },
      ],
    });
    expect(s.schemaVersion).toBe(6);
    expect(s.reglas).toEqual([]);
    expect(s.categorias.map(c => c.excluirDeAnalisis)).toEqual([true, undefined, false]);
  });
});

describe('guardado fiable', () => {
  const memoria = (falla: (k: string) => boolean) => {
    const datos: Record<string, string> = {};
    return {
      getItem: (k: string) => datos[k] ?? null,
      setItem: (k: string, v: string) => {
        if (falla(k)) throw new Error('QuotaExceededError');
        datos[k] = v;
      },
      removeItem: (k: string) => { delete datos[k]; },
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
  };

  const conDatos = () => {
    const s = getInitialState();
    s.movimientos = [{ id: 'a', fecha: '2026-01-01', importe: -5, concepto: 'x', categoria: 'c', fuente: 'manual', hash: 'h' }];
    return s;
  };

  it('saveState avisa cuando el navegador no deja escribir', () => {
    vi.stubGlobal('localStorage', memoria(() => true));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(saveState(getInitialState())).toBe(false);
    vi.stubGlobal('localStorage', memoria(() => false));
    expect(saveState(getInitialState())).toBe(true);
    vi.unstubAllGlobals();
  });

  it('una copia automática que no se ha escrito no se da por hecha', () => {
    vi.stubGlobal('localStorage', memoria(k => k === 'finni_backups'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(maybeWeeklyBackup(conDatos())).toBeNull();
    vi.stubGlobal('localStorage', memoria(() => false));
    expect(maybeWeeklyBackup(conDatos())).toEqual(expect.any(Number));
    vi.unstubAllGlobals();
  });
});
