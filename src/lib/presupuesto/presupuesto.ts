import { AppState, MesFinanciero } from '../storage/types';

/**
 * Lo que guarda el presupuesto: el límite general por categoría y las excepciones de
 * cada mes. En una excepción, `null` significa «este mes sin presupuesto» aunque haya
 * límite general; un número (también 0) es el límite de ese mes.
 */
export type Presupuestos = Pick<AppState, 'budgetTemplate' | 'budgetOverrides'>;

/** Alcance al quitar un presupuesto. Los movimientos nunca se tocan. */
export type AlcanceQuitar = 'mes' | 'desde' | 'todos';

/** Límite de la categoría en ese mes, o null si ese mes no tiene presupuesto. */
export function limiteDe(p: Presupuestos, catId: string, mesId: string): number | null {
  const mes = p.budgetOverrides?.[mesId];
  if (mes && Object.prototype.hasOwnProperty.call(mes, catId)) return mes[catId] ?? null;
  const general = p.budgetTemplate?.[catId];
  return general !== undefined ? general : null;
}

/** Categorías con presupuesto (de 0 € o más) en ese mes. */
export function categoriasConPresupuesto(p: Presupuestos, mesId: string): Set<string> {
  const ids = new Set<string>([
    ...Object.keys(p.budgetTemplate || {}),
    ...Object.keys(p.budgetOverrides?.[mesId] || {}),
  ]);
  return new Set([...ids].filter(id => limiteDe(p, id, mesId) !== null));
}

function sinCategoria(mes: Record<string, number | null> | undefined, catId: string) {
  return Object.fromEntries(Object.entries(mes || {}).filter(([k]) => k !== catId));
}

/** Límite para todos los meses. El mes desde el que se pone deja de tener excepción. */
export function ponerLimiteGeneral(p: Presupuestos, catId: string, importe: number, mesId: string): Presupuestos {
  return {
    budgetTemplate: { ...p.budgetTemplate, [catId]: importe },
    budgetOverrides: { ...p.budgetOverrides, [mesId]: sinCategoria(p.budgetOverrides?.[mesId], catId) },
  };
}

export function ponerLimiteDelMes(p: Presupuestos, catId: string, importe: number, mesId: string): Presupuestos {
  return {
    budgetTemplate: { ...p.budgetTemplate },
    budgetOverrides: { ...p.budgetOverrides, [mesId]: { ...(p.budgetOverrides?.[mesId] || {}), [catId]: importe } },
  };
}

/**
 * Quita el presupuesto de una categoría.
 * - 'mes': solo en `mes`. Si hay límite general, el resto de meses lo conservan.
 * - 'desde': de `mes` en adelante. Los meses anteriores guardan el límite que tenían,
 *   que se copia en cada uno antes de retirar el general.
 * - 'todos': de todos los meses, histórico incluido.
 */
export function quitarPresupuesto(
  p: Presupuestos,
  catId: string,
  alcance: AlcanceQuitar,
  mes: MesFinanciero,
  meses: MesFinanciero[],
): Presupuestos {
  const general = p.budgetTemplate?.[catId];
  const sinGeneral = sinCategoria(p.budgetTemplate, catId) as Record<string, number>;

  if (alcance === 'mes') {
    const delMes = sinCategoria(p.budgetOverrides?.[mes.id], catId);
    return {
      budgetTemplate: { ...p.budgetTemplate },
      budgetOverrides: {
        ...p.budgetOverrides,
        [mes.id]: general !== undefined ? { ...delMes, [catId]: null } : delMes,
      },
    };
  }

  const overrides: Record<string, Record<string, number | null>> = {};
  const inicioPorId = new Map(meses.map(m => [m.id, m.inicio]));
  for (const [mesId, valores] of Object.entries(p.budgetOverrides || {})) {
    const inicio = inicioPorId.get(mesId);
    // Un mes que ya no existe no se ve, pero se conserva tal cual en 'desde'.
    const esAnterior = inicio !== undefined ? inicio < mes.inicio : true;
    overrides[mesId] = alcance === 'todos' || !esAnterior ? sinCategoria(valores, catId) : { ...valores };
  }

  if (alcance === 'desde' && general !== undefined) {
    for (const m of meses) {
      if (m.inicio >= mes.inicio) continue;
      const valores = overrides[m.id] || {};
      if (!Object.prototype.hasOwnProperty.call(valores, catId)) {
        overrides[m.id] = { ...valores, [catId]: general };
      }
    }
  }

  return { budgetTemplate: sinGeneral, budgetOverrides: overrides };
}

/** Qué alcances tiene sentido ofrecer al quitar el presupuesto de `mes`. */
export function alcancesPosibles(
  p: Presupuestos,
  catId: string,
  mes: MesFinanciero,
  meses: MesFinanciero[],
): AlcanceQuitar[] {
  const hayGeneral = p.budgetTemplate?.[catId] !== undefined;
  const inicioPorId = new Map(meses.map(m => [m.id, m.inicio]));
  let posteriores = false;
  let otros = false;
  for (const [mesId, valores] of Object.entries(p.budgetOverrides || {})) {
    if (mesId === mes.id || !valores || !Object.prototype.hasOwnProperty.call(valores, catId)) continue;
    if (valores[catId] === null) continue;
    otros = true;
    const inicio = inicioPorId.get(mesId);
    if (inicio !== undefined && inicio > mes.inicio) posteriores = true;
  }
  const alcances: AlcanceQuitar[] = ['mes'];
  if (hayGeneral || posteriores) alcances.push('desde');
  if (hayGeneral || otros) alcances.push('todos');
  return alcances;
}

/**
 * Lo que falta por gastar del presupuesto, categoría a categoría. Un exceso en una no
 * se compensa con lo que queda en otra: cada límite es independiente.
 */
export function pendientePorCategoria(filas: { budget: number; spent: number }[]): number {
  return filas.reduce((acc, f) => acc + Math.max(0, f.budget - f.spent), 0);
}
