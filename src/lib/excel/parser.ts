import { Movimiento } from '../storage/types';
import { analizarHoja, leerConMapeo, Analisis, ResultadoLectura } from './columnas';

export interface ParsedResultado {
  banco: string;
  movimientos: Movimiento[];
  saldoActual: number;
  fechaSaldo: string; // YYYY-MM-DD local
  categoriasEncontradas: Set<string>;
}

export function parseNumberString(val: any): number {
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  // if format is something like "1.234,56" or "1,234.56"
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Spanish/European: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US/UK: 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma, e.g., "12,34"
    str = str.replace(',', '.');
  }
  return parseFloat(str);
}

/**
 * Saca las filas en crudo de la hoja con más contenido del libro. Se queda con la mayor
 * porque muchos bancos meten una hoja de portada o de instrucciones delante.
 */
export async function leerFilas(fileBase64OrBuffer: any): Promise<any[][]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(fileBase64OrBuffer, { type: 'binary' });

  let mejor: any[][] = [];
  for (const nombre of wb.SheetNames) {
    const filas = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[nombre], { header: 1, raw: false, defval: '' });
    const conDatos = filas.filter(f => f && f.some(c => String(c).trim() !== '')).length;
    const mejorConDatos = mejor.filter(f => f && f.some(c => String(c).trim() !== '')).length;
    if (conDatos > mejorConDatos) mejor = filas;
  }
  return mejor;
}

/**
 * Error de un archivo que se ha leído pero cuyas columnas no se han podido identificar
 * solas. Lleva el análisis dentro para que la pantalla ofrezca mapearlas a mano en vez
 * de dejar al usuario en un callejón sin salida.
 */
export class ErrorColumnas extends Error {
  constructor(public analisis: Analisis, public filas: any[][]) {
    super('No he reconocido las columnas de este archivo.');
    this.name = 'ErrorColumnas';
  }
}

/**
 * Lee un extracto bancario de cualquier banco: detecta las columnas por sinónimos de
 * cabecera y, si no las hay, por el contenido. Si aun así falta algo, lanza
 * `ErrorColumnas` con lo analizado para que se pueda completar a mano.
 */
export async function parseExcelData(fileBase64OrBuffer: any): Promise<ParsedResultado> {
  const filas = await leerFilas(fileBase64OrBuffer);
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
