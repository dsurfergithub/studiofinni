import { Movimiento } from '../storage/types';
import { esAjusteDeSaldo } from '../saldo/cuadre';

/** Días de margen entre la fecha del banco y la que apuntaste tú. */
export const VENTANA_DIAS = 3;

export interface Pareja {
  app: Movimiento;
  banco: Movimiento;
  /** Días de desfase entre lo apuntado y lo que dice el banco. */
  desfase: number;
}

export interface Conciliacion {
  /** Rango que cubre el extracto. Fuera de él no se juzga nada. */
  desde: string;
  hasta: string;
  casados: Pareja[];
  /** Apuntado en la app dentro del rango, pero el banco no lo tiene. */
  sobranEnApp: Movimiento[];
  /** Está en el banco y no lo tienes apuntado. */
  faltanEnApp: Movimiento[];
  /** Suma con signo de lo que sobra en la app. */
  totalSobra: number;
  /** Suma con signo de lo que falta por apuntar. */
  totalFalta: number;
  /** Lo que se moverá el saldo si aplicas todo: falta − sobra. */
  descuadre: number;
  /**
   * Ids (de las dos listas) que tienen un candidato claro en la contraria: mismo importe
   * o casi, y fechas cercanas. Casi siempre es el MISMO apunte con la fecha o el importe
   * mal tecleados, demasiado lejos para que el emparejamiento exacto lo case. Añadirlo
   * sin más lo duplicaría de verdad, así que la pantalla avisa y no lo marca solo.
   */
  idsDudosos: Set<string>;
}

/** Céntimos de margen para dar dos importes por «el mismo mal tecleado». */
export const TOLERANCIA_IMPORTE = 0.05;
/** Días de margen para lo mismo, más ancho que la ventana de emparejar. */
export const VENTANA_DUDOSOS = 10;

/** ¿Este movimiento puede ser el mismo que hay en la otra lista, mal apuntado? */
export function puedeSerElMismo(r: Conciliacion, m: Movimiento): boolean {
  return r.idsDudosos.has(m.id);
}

function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round(Math.abs(Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

const suma = (movs: Movimiento[]) => movs.reduce((s, m) => s + m.importe, 0);

/**
 * Casa lo apuntado en la app contra un extracto del banco, línea a línea.
 *
 * El emparejamiento es por importe EXACTO (al céntimo) y fecha próxima, nunca por
 * concepto: el banco no llama a las cosas como tú («Alquiler» vs «Transferencias»),
 * que es justo lo que hace inútil comparar por texto. Dos pasadas para que las
 * coincidencias limpias se lleven su pareja antes de que nadie tire de la ventana:
 *   1ª: misma fecha exacta.
 *   2ª: hasta `ventanaDias` de desfase, empezando por el desfase más pequeño.
 *
 * Cada apunte se empareja como mucho una vez, así que tres cobros de 19 € en el banco
 * exigen tres apuntes en la app: si solo hay dos, el tercero sale en `faltanEnApp`.
 *
 * Solo se juzgan los movimientos de la app DENTRO del rango del extracto: lo de antes
 * o después no es que sobre, es que el extracto no llega ahí.
 *
 * Los ajustes de saldo se ignoran: son correcciones, el banco nunca los tendrá.
 */
export function conciliar(app: Movimiento[], banco: Movimiento[], ventanaDias = VENTANA_DIAS): Conciliacion {
  if (banco.length === 0) {
    return { desde: '', hasta: '', casados: [], sobranEnApp: [], faltanEnApp: [], totalSobra: 0, totalFalta: 0, descuadre: 0, idsDudosos: new Set() };
  }

  const fechas = banco.map(m => m.fecha);
  const desde = fechas.reduce((a, b) => (a < b ? a : b));
  const hasta = fechas.reduce((a, b) => (a > b ? a : b));

  // La ventana puede sacar un apunte fuera del rango estricto, así que ampliamos al
  // buscar candidatos pero solo reclamamos «sobra» dentro del rango del extracto.
  const enRango = (f: string) => f >= desde && f <= hasta;
  const emparejable = (f: string) => enRango(f) || diasEntre(f, desde) <= ventanaDias || diasEntre(f, hasta) <= ventanaDias;
  const candidatos = app.filter(m => !esAjusteDeSaldo(m) && emparejable(m.fecha));

  const porImporte = new Map<string, Movimiento[]>();
  for (const m of candidatos) {
    const k = m.importe.toFixed(2);
    const l = porImporte.get(k);
    if (l) l.push(m); else porImporte.set(k, [m]);
  }

  const bancoOrden = [...banco].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  const usadosApp = new Set<string>();
  const casadosPorBanco = new Map<string, Pareja>();

  const emparejar = (b: Movimiento, exacto: boolean) => {
    const lista = porImporte.get(b.importe.toFixed(2));
    if (!lista) return;
    const libres = lista.filter(m => !usadosApp.has(m.id));
    const validos = exacto
      ? libres.filter(m => m.fecha === b.fecha)
      : libres.filter(m => diasEntre(m.fecha, b.fecha) <= ventanaDias);
    if (validos.length === 0) return;
    // Desfase menor primero; a igualdad se queda con la pareja el apunte IMPORTADO, para
    // que en «sobran» acabe el tecleado a mano y la lista se lea como lo que es: tus
    // apuntes de más. Al final, el más antiguo (y el id, para no depender del orden).
    const importado = (m: Movimiento) => (m.fuente.startsWith('import:') ? 0 : 1);
    validos.sort((x, y) =>
      diasEntre(x.fecha, b.fecha) - diasEntre(y.fecha, b.fecha) ||
      importado(x) - importado(y) ||
      x.fecha.localeCompare(y.fecha) || x.id.localeCompare(y.id));
    const elegido = validos[0];
    usadosApp.add(elegido.id);
    casadosPorBanco.set(b.id, { app: elegido, banco: b, desfase: diasEntre(elegido.fecha, b.fecha) });
  };

  for (const b of bancoOrden) emparejar(b, true);
  for (const b of bancoOrden) if (!casadosPorBanco.has(b.id)) emparejar(b, false);

  const casados = bancoOrden.map(b => casadosPorBanco.get(b.id)).filter((p): p is Pareja => !!p);
  const faltanEnApp = bancoOrden.filter(b => !casadosPorBanco.has(b.id));
  const sobranEnApp = candidatos
    .filter(m => !usadosApp.has(m.id) && enRango(m.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

  const totalSobra = suma(sobranEnApp);
  const totalFalta = suma(faltanEnApp);

  // Un apunte que quedó suelto en cada lista, con el mismo importe (o a un céntimo) y
  // fechas cercanas, casi siempre es el mismo mal tecleado. Caso real: la nómina que el
  // banco pagó el 31-jul por 1.813,11 € y estaba apuntada el 1-ago por 1.813,12 €.
  const idsDudosos = new Set<string>();
  for (const falta of faltanEnApp) {
    for (const sobra of sobranEnApp) {
      if (Math.abs(falta.importe - sobra.importe) > TOLERANCIA_IMPORTE) continue;
      if (diasEntre(falta.fecha, sobra.fecha) > VENTANA_DUDOSOS) continue;
      idsDudosos.add(falta.id);
      idsDudosos.add(sobra.id);
    }
  }

  return { desde, hasta, casados, sobranEnApp, faltanEnApp, totalSobra, totalFalta, descuadre: totalFalta - totalSobra, idsDudosos };
}
