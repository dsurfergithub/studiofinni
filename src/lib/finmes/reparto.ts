import { MesFinanciero, Movimiento } from '../storage/types';
import { mesIdDeMovimiento } from './finmes';

/** Qué hacer con un movimiento que cae fuera del periodo mayoritario de su importación. */
export type Decision = 'dejar' | 'mover' | 'excluir';

export interface GrupoPeriodo {
  /** Id del periodo, o '' si el movimiento no cae en ninguno. */
  mesId: string;
  /** Nombre del periodo tal y como se ve en el selector de mes. */
  nombre: string;
  inicio: string;
  fin: string;
  movimientos: Movimiento[];
}

export interface Reparto {
  /** Periodo que recibe MÁS movimientos: el destino que se propone para el resto. */
  principal: GrupoPeriodo;
  /** Los demás periodos afectados, de más a menos movimientos. */
  fuera: GrupoPeriodo[];
  /** Nº de movimientos que no caen en el periodo principal. */
  nFuera: number;
}

const SIN_PERIODO: Pick<GrupoPeriodo, 'nombre' | 'inicio' | 'fin'> = {
  nombre: 'Fuera de todo periodo',
  inicio: '',
  fin: '',
};

/**
 * Agrupa los movimientos de una importación por el periodo al que caerían.
 *
 * Los periodos de Finni van de nómina a nómina, así que un archivo de un mes natural
 * (p. ej. todo agosto) se reparte casi siempre entre dos periodos. Devuelve `null`
 * cuando todo cae en el mismo: entonces no hay nada que preguntarle al usuario.
 */
export function repartirPorPeriodo(movimientos: Movimiento[], meses: MesFinanciero[]): Reparto | null {
  if (movimientos.length === 0) return null;

  const grupos = new Map<string, GrupoPeriodo>();
  for (const mov of movimientos) {
    const id = mesIdDeMovimiento(mov, meses) || '';
    let grupo = grupos.get(id);
    if (!grupo) {
      const mes = meses.find(m => m.id === id);
      grupo = { mesId: id, ...(mes ? { nombre: mes.nombre, inicio: mes.inicio, fin: mes.fin } : SIN_PERIODO), movimientos: [] };
      grupos.set(id, grupo);
    }
    grupo.movimientos.push(mov);
  }
  if (grupos.size < 2) return null;

  // Empate a movimientos: gana el periodo más reciente, que es donde el usuario está mirando.
  const orden = Array.from(grupos.values()).sort(
    (a, b) => b.movimientos.length - a.movimientos.length || b.inicio.localeCompare(a.inicio)
  );
  const [principal, ...fuera] = orden;
  return { principal, fuera, nFuera: fuera.reduce((n, g) => n + g.movimientos.length, 0) };
}

/**
 * Aplica lo que el usuario haya decidido para cada movimiento de fuera:
 * - `mover`: se clava (`mesId`) al periodo destino sin tocar su fecha real.
 * - `excluir`: no se importa.
 * - `dejar` (por defecto): cae donde le corresponde por fecha.
 */
export function aplicarDecisiones(
  movimientos: Movimiento[],
  decisiones: Map<string, Decision>,
  mesDestinoId: string
): Movimiento[] {
  const resultado: Movimiento[] = [];
  for (const mov of movimientos) {
    const decision = decisiones.get(mov.id) || 'dejar';
    if (decision === 'excluir') continue;
    if (decision === 'mover' && mesDestinoId) {
      resultado.push({ ...mov, mesId: mesDestinoId });
      continue;
    }
    resultado.push(mov);
  }
  return resultado;
}
