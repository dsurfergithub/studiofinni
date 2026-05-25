export interface Movimiento {
  id: string;
  fecha: string; // YYYY-MM-DD local
  importe: number;
  concepto: string;
  categoria: string; // Categoria ID
  subcategoria?: string;
  fuente: 'manual' | 'import:caixabank';
  hash: string;
  tags?: string[];
  notas?: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  icono?: string;
  tipo: 'gasto' | 'ingreso' | 'ambos';
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

export interface AppState {
  schemaVersion: number;
  movimientos: Movimiento[];
  categorias: Categoria[];
  nominasAncla: NominaAncla[];
  mesesPersonalizados: MesFinanciero[];
  budgetTemplate: Record<string, number>;
  budgetOverrides: Record<string, Record<string, number>>;
  savingsGoal: number;
  cuenta: {
    banco: string;
    saldoActual: number;
    fechaSaldo: string; // YYYY-MM-DD
  };
  meta: {
    creadoEn: number;
    ultimaModificacion: number;
  };
}
