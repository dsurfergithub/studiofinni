import { Categoria, MacroTipo, Movimiento, PlanFila } from '../storage/types';

export interface PlanColumna {
  id: string; // clave usada en PlanFila.grupos (coincide con los grupos legacy)
  nombre: string;
  color: string;
  macro: MacroTipo;
}

// Columnas fijas del plan anual. Cada categoría de gasto pertenece a una de ellas
// a través de su macro-grupo; los ingresos van a la columna "Sueldo".
export const PLAN_COLUMNAS: PlanColumna[] = [
  { id: 'fijos', nombre: 'Fijos', color: '#ef4444', macro: 'fijo' },
  { id: 'variables', nombre: 'Variables', color: '#f59e0b', macro: 'variable' },
  { id: 'inversion', nombre: 'Inversión', color: '#22c55e', macro: 'inversion' },
];

export const MACRO_OPCIONES: { valor: MacroTipo; nombre: string; ayuda: string }[] = [
  { valor: 'fijo', nombre: 'Fijo', ayuda: 'Alquiler, luz, suscripciones… lo que pagas sí o sí' },
  { valor: 'variable', nombre: 'Variable', ayuda: 'Compra, ocio, restaurantes… varía cada mes' },
  { valor: 'inversion', nombre: 'Inversión', ayuda: 'Fondos, acciones, plan de pensiones…' },
];

/** Macro-grupo efectivo de una categoría (si falta, cuenta como variable). */
export function macroDeCategoria(cat?: Categoria): MacroTipo {
  return cat?.macro || 'variable';
}

export function columnaDeMacro(macro: MacroTipo): PlanColumna {
  return PLAN_COLUMNAS.find(c => c.macro === macro) || PLAN_COLUMNAS[1];
}

export function emptyPlanFila(): PlanFila {
  return { sueldo: 0, grupos: {} };
}

/**
 * Agrega los movimientos reales de un año natural (por fecha) en 12 filas con la
 * misma forma que el plan: ingresos → sueldo, gastos → columna de su macro-grupo.
 */
export function realDelAnio(
  movimientos: Movimiento[],
  categorias: Categoria[],
  year: string,
): PlanFila[] {
  const filas: PlanFila[] = Array.from({ length: 12 }, emptyPlanFila);
  const catById = new Map(categorias.map(c => [c.id, c]));
  const prefijo = `${year}-`;

  for (const m of movimientos) {
    if (!m.fecha.startsWith(prefijo)) continue;
    const idx = parseInt(m.fecha.slice(5, 7), 10) - 1;
    if (idx < 0 || idx > 11) continue;
    if (m.importe > 0) {
      filas[idx].sueldo += m.importe;
    } else {
      const col = columnaDeMacro(macroDeCategoria(catById.get(m.categoria))).id;
      filas[idx].grupos[col] = (filas[idx].grupos[col] || 0) + Math.abs(m.importe);
    }
  }
  return filas;
}
