import { AppState, PlanAnual, PlanFila } from './types';
import { PLAN_COLUMNAS } from '../plan/plan';

const STORAGE_KEY = 'finni_v2';
const BACKUP_KEY = 'finni_backups';
const CURRENT_SCHEMA_VERSION = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BACKUPS = 4;

export function defaultPlanAnual(): PlanAnual {
  return { datos: {}, escenario: {} };
}

export function getInitialState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    hasOnboarded: false,
    theme: 'dark',
    movimientos: [],
    categorias: [],
    suscripciones: [],
    nominasAncla: [],
    mesesPersonalizados: [],
    budgetTemplate: {},
    budgetOverrides: {},
    savingsGoal: 0,
    savingsAcumulado: 0,
    savingsMetas: [],
    planAnual: defaultPlanAnual(),
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

export function migrate(state: any): AppState {
  const base = getInitialState();
  let s = { ...base, ...state };

  // Asegura estructuras anidadas que pudieran faltar en versiones antiguas.
  s.cuenta = { ...base.cuenta, ...(state.cuenta || {}) };
  s.meta = { ...base.meta, ...(state.meta || {}) };

  if (!s.schemaVersion) s.schemaVersion = 1;
  if (s.savingsGoal === undefined) s.savingsGoal = 0;
  if (s.savingsAcumulado === undefined) s.savingsAcumulado = 0;
  // Comprobamos el estado original (no el fusionado) para no perder migraciones legacy.
  if (state.hasOnboarded === undefined) {
    s.hasOnboarded = (state.movimientos?.length > 0 || !!state.cuenta?.fechaSaldo);
  }
  if (!Array.isArray(state.savingsMetas)) {
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

  // --- Migración a schema v2 ---
  if (s.schemaVersion < 2) {
    if (!Array.isArray(s.suscripciones)) s.suscripciones = [];
    if (!s.theme) s.theme = 'dark';
    // Los movimientos previos contaban siempre para el presupuesto.
    s.movimientos = (s.movimientos || []).map((m: any) => ({
      ...m,
      enPresupuesto: m.enPresupuesto !== undefined ? m.enPresupuesto : true,
    }));
    s.schemaVersion = 2;
  }

  // --- Migración a schema v3: plan anual ---
  if (s.schemaVersion < 3) {
    if (!s.planAnual || typeof s.planAnual !== 'object') s.planAnual = defaultPlanAnual();
    s.schemaVersion = 3;
  }

  // --- Migración a schema v4: macro-grupos fijos en el plan + escenario ---
  if (s.schemaVersion < 4) {
    if (!s.planAnual || typeof s.planAnual !== 'object') s.planAnual = defaultPlanAnual();
    // El plan v3 tenía grupos libres; las columnas pasan a ser los 3 macro-grupos.
    // Los importes de grupos desconocidos se suman a 'variables' para no perder datos.
    const conocidos = new Set(PLAN_COLUMNAS.map(c => c.id));
    const datos: Record<string, PlanFila[]> = {};
    for (const [year, filas] of Object.entries(s.planAnual.datos || {}) as [string, any[]][]) {
      datos[year] = (filas || []).map((f: any) => {
        const grupos: Record<string, number> = {};
        for (const [gid, val] of Object.entries(f?.grupos || {})) {
          const destino = conocidos.has(gid) ? gid : 'variables';
          grupos[destino] = (grupos[destino] || 0) + (Number(val) || 0);
        }
        return { sueldo: Number(f?.sueldo) || 0, grupos };
      });
    }
    s.planAnual = { datos, escenario: s.planAnual.escenario || {} };
    s.schemaVersion = 4;
  }

  // Defensa adicional por si vienen campos sueltos.
  if (!Array.isArray(s.suscripciones)) s.suscripciones = [];
  if (s.theme !== 'light' && s.theme !== 'dark') s.theme = 'dark';
  if (!s.planAnual || typeof s.planAnual !== 'object') s.planAnual = defaultPlanAnual();
  if (!s.planAnual.datos || typeof s.planAnual.datos !== 'object') s.planAnual.datos = {};
  if (!s.planAnual.escenario || typeof s.planAnual.escenario !== 'object') s.planAnual.escenario = {};

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

// ---------- Auto-backup semanal ----------

export interface BackupSnapshot {
  fecha: number; // timestamp
  data: AppState;
}

export function getBackups(): BackupSnapshot[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BackupSnapshot[];
  } catch {
    return [];
  }
}

function setBackups(backups: BackupSnapshot[]) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  } catch (error) {
    console.error('Failed to persist backups', error);
  }
}

/**
 * Crea un snapshot si ha pasado más de una semana desde el último auto-backup.
 * Devuelve el nuevo timestamp si hizo backup, o null si no tocaba.
 */
export function maybeWeeklyBackup(state: AppState): number | null {
  const last = state.meta.ultimoAutoBackup || 0;
  const now = Date.now();
  if (now - last < WEEK_MS) return null;
  // No hacer backup de un estado vacío.
  if (state.movimientos.length === 0 && !state.cuenta.fechaSaldo) return null;

  const backups = getBackups();
  backups.unshift({ fecha: now, data: state });
  setBackups(backups.slice(0, MAX_BACKUPS));
  return now;
}

export function createManualBackup(state: AppState): void {
  const backups = getBackups();
  backups.unshift({ fecha: Date.now(), data: state });
  setBackups(backups.slice(0, MAX_BACKUPS));
}
