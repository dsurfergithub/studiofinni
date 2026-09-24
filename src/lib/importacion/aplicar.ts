import { AppState, Categoria, MesFinanciero, Movimiento } from '../storage/types';
import { derivarMeses, generarMesesFuturos, mesesParaCubrir, mesesRestantesDelAnio, mesIdDeMovimiento } from '../finmes/finmes';
import { detectarNominas, quitarPeriodosSolapados } from '../finmes/nominas';

export interface SaldoExtracto {
  saldoActual: number;
  fechaSaldo: string;
}

/**
 * Lo que cambia en el estado al volcar un extracto ya revisado. Es una función pura para
 * que el onboarding y Ajustes hagan exactamente lo mismo (antes cada uno tenía su copia).
 *
 * - Añade movimientos y categorías nuevas; nunca borra.
 * - Recalcula las nóminas con TODO el historial y, con ellas, los periodos.
 * - Quita los periodos "del 1 al 31" que pisan a los de nómina y planifica el resto del año.
 * - Cubre hacia atrás los movimientos anteriores a la primera nómina, para que ninguno
 *   quede fuera de todo periodo.
 * - Solo mueve el saldo si el extracto es igual o más reciente que el que ya había: subir
 *   el extracto de un mes viejo no puede devolverte al saldo de entonces.
 */
export function volcarExtracto(
  state: AppState,
  nuevos: Movimiento[],
  nuevasCategorias: Categoria[],
  saldo: SaldoExtracto
): { cambios: Partial<AppState>; mesDestino: string } {
  const idsCat = new Set(state.categorias.map(c => c.id));
  const categorias = [...state.categorias, ...nuevasCategorias.filter(c => !idsCat.has(c.id))];
  const nombre = new Map(categorias.map(c => [c.id, c.nombre]));

  const movimientos = [...state.movimientos, ...nuevos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const nominasAncla = detectarNominas(movimientos, id => nombre.get(id) || id);
  const derivados = derivarMeses(nominasAncla);
  const base = derivados[0];
  const futuros = base ? generarMesesFuturos(base, mesesRestantesDelAnio(base) || 12) : [];

  const mapa = new Map<string, MesFinanciero>();
  quitarPeriodosSolapados(state.mesesPersonalizados || [], [...derivados, ...futuros]).forEach(m => mapa.set(m.id, m));
  futuros.forEach(m => mapa.set(m.id, m));

  // Lo anterior a la primera nómina también necesita un periodo donde verse.
  if (movimientos.length > 0) {
    const activos = [...derivados, ...Array.from(mapa.values())];
    const minFecha = movimientos[movimientos.length - 1].fecha;
    const maxFecha = movimientos[0].fecha;
    mesesParaCubrir(activos, minFecha, maxFecha).forEach(m => mapa.set(m.id, m));
  }
  const mesesPersonalizados = Array.from(mapa.values()).sort((a, b) => b.inicio.localeCompare(a.inicio));

  const saldoMasNuevo = !!saldo.fechaSaldo && (!state.cuenta.fechaSaldo || saldo.fechaSaldo >= state.cuenta.fechaSaldo);

  // Se aterriza en el periodo del movimiento importado más reciente.
  const todosLosMeses = [...derivados, ...mesesPersonalizados];
  const masReciente = nuevos.reduce<Movimiento | null>((a, m) => (!a || m.fecha > a.fecha ? m : a), null);
  const mesDestino = (masReciente && mesIdDeMovimiento(masReciente, todosLosMeses)) || base?.id || '';

  return {
    cambios: {
      movimientos,
      categorias,
      nominasAncla,
      mesesPersonalizados,
      ...(saldoMasNuevo ? { cuenta: { ...state.cuenta, saldoActual: saldo.saldoActual, fechaSaldo: saldo.fechaSaldo } } : {}),
    },
    mesDestino,
  };
}
