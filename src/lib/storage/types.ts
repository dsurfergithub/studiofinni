export type Theme = 'dark' | 'light';

export interface Movimiento {
  id: string;
  fecha: string; // YYYY-MM-DD local
  importe: number;
  concepto: string;
  categoria: string; // Categoria ID
  subcategoria?: string;
  fuente: 'manual' | 'import:caixabank' | 'suscripcion';
  hash: string;
  tags?: string[];
  notas?: string;
  // Si es false, es un gasto puntual/aislado que NO consume el presupuesto.
  // Por defecto true para no romper datos importados.
  enPresupuesto?: boolean;
  // Enlace a la suscripción que generó este movimiento (si aplica).
  suscripcionId?: string;
  // Mes financiero al que se asigna explícitamente (pin). Si está y apunta a un mes
  // existente, el movimiento cuenta SOLO en ese mes (traspaso), sin tocar su fecha real.
  // Si no está, la pertenencia se deriva de la fecha como hasta ahora.
  mesId?: string;
}

// Macro-grupo al que pertenece una categoría de gasto. Agrupa las categorías en
// los tres grandes bloques del plan anual. Si falta, se trata como 'variable'.
export type MacroTipo = 'fijo' | 'variable' | 'inversion';

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  icono?: string;
  tipo: 'gasto' | 'ingreso' | 'ambos';
  macro?: MacroTipo;
}

export interface Suscripcion {
  id: string;
  nombre: string;
  importe: number; // coste por periodo (siempre positivo)
  frecuencia: 'mensual' | 'anual';
  diaCobro: number; // 1-28 (día del mes en que se carga)
  categoria: string; // Categoria ID
  icono?: string;
  color?: string;
  activa: boolean;
  inicio: string; // YYYY-MM-DD desde cuándo está activa
  // Última clave de periodo en la que ya se generó el cargo: 'YYYY-MM' (mensual) o 'YYYY' (anual)
  ultimoCargo?: string;
  // true = recurrente de ingreso (nómina, alquiler cobrado…): genera movimientos positivos.
  esIngreso?: boolean;
}

export interface NominaAncla {
  id: string;
  fecha: string; // YYYY-MM-DD local
  importe: number;
  concepto: string;
  movimientoId?: string;
}

export interface MesFinanciero {
  id: string;
  nombre: string;
  clave: string; // YYYY-MM
  inicio: string; // YYYY-MM-DD
  fin: string; // YYYY-MM-DD
  esEstimado?: boolean;
}

export interface SavingsMeta {
  id: string;
  nombre: string;
  icono: string;
  meta: number;
  acumulado: number;
}

// ---- Plan anual (planificación manual tipo hoja de cálculo) ----
// Las columnas del plan son fijas y se corresponden con los macro-grupos:
// 'fijos' | 'variables' | 'inversion' (ver PLAN_COLUMNAS en lib/plan/plan.ts).
export interface PlanFila {
  sueldo: number;
  // importe planificado por macro-grupo: { [columnaId]: number }
  grupos: Record<string, number>;
}

export interface PlanAnual {
  // Por año natural -> 12 filas (índice 0 = enero, 11 = diciembre).
  datos: Record<string, PlanFila[]>;
  // Escenario alternativo editable ("¿y si…?") con la misma estructura que datos.
  escenario: Record<string, PlanFila[]>;
}

export interface AppState {
  schemaVersion: number;
  hasOnboarded: boolean;
  theme: Theme;
  movimientos: Movimiento[];
  categorias: Categoria[];
  suscripciones: Suscripcion[];
  nominasAncla: NominaAncla[];
  mesesPersonalizados: MesFinanciero[];
  // Presupuesto base por categoría (se aplica a todos los meses salvo override).
  budgetTemplate: Record<string, number>;
  // Presupuesto específico por mes: { [mesId]: { [catId]: importe } }
  budgetOverrides: Record<string, Record<string, number>>;
  savingsGoal: number;
  savingsAcumulado: number;
  savingsMetas: SavingsMeta[];
  // Plan anual manual: grupos configurables + cifras por mes y año.
  planAnual: PlanAnual;
  cuenta: {
    banco: string;
    saldoActual: number;
    fechaSaldo: string; // YYYY-MM-DD
  };
  meta: {
    creadoEn: number;
    ultimaModificacion: number;
    ultimoAutoBackup?: number; // timestamp del último backup automático
  };
}
