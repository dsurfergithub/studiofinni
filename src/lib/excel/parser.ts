import { Movimiento } from '../storage/types';
import { analizarHoja, leerConMapeo, ErrorColumnas, ResultadoLectura } from './columnas';
import { normalizarTexto } from './valores';

// `parseNumberString` vive ahora en `valores.ts`, junto a `parseFecha`. Se reexportan
// ambos para no romper a quien ya los importaba de aquí (y para no crear un ciclo).
export { parseNumberString } from './valores';
export { ErrorColumnas } from './columnas';

export interface ParsedResultado {
  banco: string;
  movimientos: Movimiento[];
  saldoActual: number;
  fechaSaldo: string; // YYYY-MM-DD local
  categoriasEncontradas: Set<string>;
}

export interface OpcionesLectura {
  /**
   * `true` devuelve el valor original de cada celda en vez del texto formateado. Lo usa
   * la plantilla: con `false`, SheetJS "adivina" las fechas de texto ambiguas en formato
   * US (05/07 → 5-mayo en vez de 5-julio) y los gastos acaban en otro mes.
   */
  raw?: boolean;
  /** Nombre de hoja a preferir si existe (p. ej. «Gastos» en la plantilla). */
  hojaPreferida?: string;
}

/**
 * Saca las filas en crudo de la hoja con más contenido del libro. Se queda con la mayor
 * porque muchos bancos meten una hoja de portada o de instrucciones delante.
 */
export async function leerFilas(fileBase64OrBuffer: any, opciones: OpcionesLectura = {}): Promise<any[][]> {
  const XLSX = await import('xlsx');
  const raw = opciones.raw === true;
  const wb = XLSX.read(fileBase64OrBuffer, { type: 'binary', raw });

  const deHoja = (nombre: string) =>
    XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nombre], { header: 1, raw, defval: '' });

  if (opciones.hojaPreferida) {
    const buscada = normalizarTexto(opciones.hojaPreferida);
    const hoja = wb.SheetNames.find(n => normalizarTexto(n) === buscada);
    if (hoja) return deHoja(hoja);
  }

  let mejor: any[][] = [];
  const conDatos = (filas: any[][]) => filas.filter(f => f && f.some(c => String(c).trim() !== '')).length;
  for (const nombre of wb.SheetNames) {
    const filas = deHoja(nombre);
    if (conDatos(filas) > conDatos(mejor)) mejor = filas;
  }
  return mejor;
}

/**
 * Lee un extracto bancario de cualquier banco: detecta las columnas por sinónimos de
 * cabecera y, si no las hay, por el contenido. Si aun así falta algo, lanza
 * `ErrorColumnas` con lo analizado para que se pueda completar a mano.
 */
export async function parseExcelData(fileBase64OrBuffer: any): Promise<ParsedResultado> {
  // En crudo, igual que la plantilla: si SheetJS formatea la celda, una fecha con el
  // formato por defecto de Excel sale como «9/24/26» (mes/día) y nuestro lector, que es
  // DD/MM, la descarta o la pone en otro mes. El número de serie no tiene esa ambigüedad.
  const filas = await leerFilas(fileBase64OrBuffer, { raw: true });
  if (filas.length === 0) throw new Error('El archivo no tiene ninguna hoja con datos.');

  const analisis = analizarHoja(filas);
  if (!analisis.completo) throw new ErrorColumnas(analisis, filas);

  return adaptar(leerConMapeo(filas, analisis.mapeo));
}

/** Adapta la lectura genérica a la forma que ya esperaban el onboarding y los ajustes. */
export function adaptar(r: ResultadoLectura): ParsedResultado {
  return {
    banco: 'Importado',
    movimientos: r.movimientos,
    saldoActual: r.saldoActual,
    fechaSaldo: r.fechaSaldo,
    categoriasEncontradas: new Set(r.categoriasEncontradas.values()),
  };
}
