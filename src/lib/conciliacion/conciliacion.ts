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
   * Importes (con 2 decimales) que salen a la vez en `faltanEnApp` y en `sobranEnApp`.
   * Casi siempre es lo MISMO apunte con la fecha equivocada, demasiado lejos para que la
   * ventana lo case. Añadirlo sin más lo duplicaría de verdad, así que la pantalla avisa
   * y no lo marca solo.
   */
  importesEnAmbos: Set<string>;
}

/** ¿Este movimiento puede ser el mismo que hay en la otra lista, con otra fecha? */
export function puedeSerElMismo(r: Conciliacion, m: Movimiento): boolean {
  return r.importesEnAmbos.has(m.importe.toFixed(2));
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
    return { desde: '', hasta: '', casados: [], sobranEnApp: [], faltanEnApp: [], totalSobra: 0, totalFalta: 0, descuadre: 0, importesEnAmbos: new Set() };
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

  const importesSobran = new Set(sobranEnApp.map(m => m.importe.toFixed(2)));
  const importesEnAmbos = new Set(
    faltanEnApp.map(m => m.importe.toFixed(2)).filter(k => importesSobran.has(k))
  );

  return { desde, hasta, casados, sobranEnApp, faltanEnApp, totalSobra, totalFalta, descuadre: totalFalta - totalSobra, importesEnAmbos };
}
