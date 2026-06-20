import { AppState } from './types';

const STORAGE_KEY = 'finni_v2';
const CURRENT_SCHEMA_VERSION = 1;

export function getInitialState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    hasOnboarded: false,
    movimientos: [],
    categorias: [],
    nominasAncla: [],
    mesesPersonalizados: [],
    budgetTemplate: {},
    budgetOverrides: {},
    savingsGoal: 0,
    savingsAcumulado: 0,
    savingsMetas: [],
    cuenta: {
      banco: '',
      saldoActual: 0,
      fechaSaldo: '',
    },
    meta: {
      creadoEn: Date.now(),
      ultimaModificacion: Date.now(),
    },
  };
}

function migrate(state: any): AppState {
  // If no schema version, or it's v1, check if we need to do anything
  let s = { ...state };
  if (!s.schemaVersion) {
    s.schemaVersion = 1;
  }
  if (s.savingsGoal === undefined) {
    s.savingsGoal = 0;
  }
  if (s.savingsAcumulado === undefined) {
    s.savingsAcumulado = 0;
  }
  if (s.hasOnboarded === undefined) {
    s.hasOnboarded = (s.movimientos?.length > 0 || !!s.cuenta?.fechaSaldo);
  }
  if (!s.savingsMetas) {
    s.savingsMetas = [];
    if ((s.savingsGoal || 0) > 0) {
      s.savingsMetas = [{
        id: 'meta-legacy',
        nombre: 'Meta de ahorro',
        icono: '🎯',
        meta: s.savingsGoal,
        acumulado: s.savingsAcumulado || 0,
      }];
    }
  }
  
  // Future migrations can go here (e.g. if schemaVersion === 1, migrate to 2)
  // if (s.schemaVersion === 1) { 
  //   // do work
  //   s.schemaVersion = 2;
  // }
  
  return s as AppState;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (error) {
    console.error('Failed to load state from localStorage', error);
    return getInitialState();
  }
}

export function saveState(state: AppState): void {
  try {
    state.meta.ultimaModificacion = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage', error);
  }
}
