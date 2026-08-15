import { Movimiento } from '../storage/types';
import { esAjusteDeSaldo } from '../saldo/cuadre';

/** Días de margen: dos apuntes del mismo importe a menos de esto son sospechosos. */
export const VENTANA_DIAS = 3;

export type MotivoDuplicado = 'origen-distinto' | 'doble-tecleo';

export const ETIQUETA_MOTIVO: Record<MotivoDuplicado, string> = {
  'origen-distinto': 'Uno a mano y otro importado',
  'doble-tecleo': 'Apuntado dos veces a mano',
};

export interface GrupoDuplicado {
  /** Clave estable (importe + primera fecha), para listas de React. */
  id: string;
  importe: number;
  motivo: MotivoDuplicado;
  /** Los apuntes implicados, del más antiguo al más reciente. */
  movimientos: Movimiento[];
  /** Lo que sobra si te quedas con uno solo: |importe| × (n − 1). */
  importeSobrante: number;
}

const normalizar = (s: string) => s.trim().toLowerCase();

/** Dos apuntes a mano, mismo día y mismo concepto: el clásico «lo he metido dos veces». */
function hayDobleTecleo(racimo: Movimiento[]): boolean {
  for (let i = 0; i < racimo.length; i++) {
    for (let k = i + 1; k < racimo.length; k++) {
      const a = racimo[i], b = racimo[k];
      if (a.fuente === 'manual' && b.fuente === 'manual' && a.fecha === b.fecha && normalizar(a.concepto) === normalizar(b.concepto)) return true;
    }
  }
  return false;
}

function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const msA = Date.UTC(ya, ma - 1, da);
  const msB = Date.UTC(yb, mb - 1, db);
  return Math.round(Math.abs(msB - msA) / 86400000);
}

/**
 * Busca apuntes repetidos: mismo importe exacto y fechas próximas.
 *
 * El anti-duplicados de los imports compara el hash `fecha|importe|concepto`, así que
 * NO ve un gasto tecleado a mano y luego importado del banco con otro nombre
 * («Alquiler» vs «Transferencias»). Esto sí.
 *
 * Para no ahogar en falsos positivos, un grupo solo se marca si además de caer dentro
 * de la ventana cumple una de estas:
 *  - vienen de ORÍGENES distintos (uno a mano y otro importado): el caso real, y el
 *    único que el hash no puede ver porque el concepto del banco no es el que tecleas;
 *  - son dos apuntes a mano del mismo día con el mismo concepto (doble tecleo).
 *
 * Lo que NO se marca: varios apuntes del mismo importe y día venidos del mismo import.
 * El banco no lista dos veces la misma operación, así que son cobros distintos que
 * coinciden (cinco bizums de 19 € en una tarde), y el hash ya descarta el re-import.
 *
 * Los ajustes de saldo se ignoran: no son gasto ni ingreso real.
 */
export function buscarDuplicados(movimientos: Movimiento[], ventanaDias = VENTANA_DIAS): GrupoDuplicado[] {
  const porImporte = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    if (esAjusteDeSaldo(m)) continue;
    const clave = m.importe.toFixed(2);
    const lista = porImporte.get(clave);
    if (lista) lista.push(m); else porImporte.set(clave, [m]);
  }

  const grupos: GrupoDuplicado[] = [];

  for (const lista of porImporte.values()) {
    if (lista.length < 2) continue;
    const orden = [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

    // Racimos encadenados: se corta en cuanto hay un salto mayor que la ventana.
    let racimo: Movimiento[] = [orden[0]];
    const cerrar = () => {
      if (racimo.length < 2) return;
      const origenDistinto = new Set(racimo.map(m => m.fuente)).size > 1;
      const dobleTecleo = !origenDistinto && hayDobleTecleo(racimo);
      if (!origenDistinto && !dobleTecleo) return;
      grupos.push({
        id: `${racimo[0].importe.toFixed(2)}|${racimo[0].fecha}|${racimo[0].id}`,
        importe: racimo[0].importe,
        motivo: origenDistinto ? 'origen-distinto' : 'doble-tecleo',
        movimientos: racimo,
        importeSobrante: Math.abs(racimo[0].importe) * (racimo.length - 1),
      });
    };

    for (let i = 1; i < orden.length; i++) {
      if (diasEntre(orden[i - 1].fecha, orden[i].fecha) <= ventanaDias) {
        racimo.push(orden[i]);
      } else {
        cerrar();
        racimo = [orden[i]];
      }
    }
    cerrar();
  }

  // Primero lo que más dinero mueve: es donde de verdad se descuadra el saldo.
  return grupos.sort((a, b) => b.importeSobrante - a.importeSobrante || a.id.localeCompare(b.id));
}

/**
 * De un grupo, cuál conviene CONSERVAR: el apunte importado del banco manda sobre el
 * tecleado a mano (el banco es la fuente de verdad) y, a igualdad, el más antiguo.
 */
export function movimientoAConservar(grupo: GrupoDuplicado): Movimiento {
  const esDelBanco = (m: Movimiento) => m.fuente.startsWith('import:');
  return [...grupo.movimientos].sort((a, b) => {
    if (esDelBanco(a) !== esDelBanco(b)) return esDelBanco(a) ? -1 : 1;
    return a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id);
  })[0];
}

/** Ids que sobran en un grupo si te quedas solo con el que manda. */
export function idsSobrantes(grupo: GrupoDuplicado): string[] {
  const conservar = movimientoAConservar(grupo);
  return grupo.movimientos.filter(m => m.id !== conservar.id).map(m => m.id);
}
