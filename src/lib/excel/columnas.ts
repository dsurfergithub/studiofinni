import { v4 as uuidv4 } from 'uuid';
import { Movimiento } from '../storage/types';
import { parseFecha, esFecha, normalizarTexto, parseNumberString } from './valores';

export type Campo =
  | 'fecha' | 'concepto' | 'importe' | 'debito' | 'credito'
  | 'saldo' | 'categoria' | 'subcategoria' | 'tipo' | 'notas';

/**
 * Sinónimos de cabecera por campo. El orden del objeto ES el orden de prioridad al
 * clasificar una celda: `subcategoria` antes que `categoria` (porque «SUBCATEGORÍA»
 * contiene «CATEGORÍA») y `fecha` antes que `importe` (porque «F. VALOR» contiene
 * «VALOR»). Cada campo se queda con la PRIMERA columna que lo reclama.
 */
const SINONIMOS: Record<Campo, string[]> = {
  subcategoria: ['SUBCATEGORIA', 'SUBCATEGORY', 'SUBTIPO'],
  categoria: ['CATEGORIA', 'CATEGORY', 'TIPO DE GASTO'],
  fecha: ['F. VALOR', 'F.VALOR', 'FECHA VALOR', 'FECHA OPERACION', 'FECHA CONTABLE', 'F. OPERACION', 'FECHA', 'VALUE DATE', 'BOOKING DATE', 'DATE', 'DIA'],
  saldo: ['SALDO', 'BALANCE'],
  debito: ['CARGO', 'DEBE', 'DEBITO', 'DEBIT', 'SALIDA', 'PAGOS'],
  credito: ['ABONO', 'HABER', 'CREDITO', 'CREDIT', 'ENTRADA', 'COBROS'],
  importe: ['IMPORTE', 'CANTIDAD', 'AMOUNT', 'MOVIMIENTO EUR', 'EUROS'],
  // 'TIPO' va antes que 'concepto' para que no se lo lleve «TIPO DE MOVIMIENTO».
  tipo: ['TIPO', 'GASTO/INGRESO', 'SIGNO'],
  notas: ['NOTAS', 'COMENTARIO', 'NOTES', 'ANOTACIONES'],
  concepto: ['CONCEPTO', 'DESCRIPCION', 'DESCRIPTION', 'DETALLE', 'MOVIMIENTO', 'REFERENCIA', 'BENEFICIARIO', 'TEXTO', 'OBSERVACIONES'],
};

const ORDEN: Campo[] = ['subcategoria', 'categoria', 'fecha', 'saldo', 'debito', 'credito', 'importe', 'tipo', 'notas', 'concepto'];

export const ETIQUETA_CAMPO: Record<Campo, string> = {
  fecha: 'Fecha',
  concepto: 'Concepto',
  importe: 'Importe',
  debito: 'Cargos',
  credito: 'Abonos',
  saldo: 'Saldo',
  categoria: 'Categoría',
  subcategoria: 'Subcategoría',
  tipo: 'Gasto o ingreso',
  notas: 'Notas',
};

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

export interface Mapeo {
  /** Fila de cabeceras, o -1 si el archivo no tiene. */
  filaCabecera: number;
  /** Primera fila con datos. */
  filaDatos: number;
  columnas: Partial<Record<Campo, number>>;
}

export interface ColumnaInfo {
  indice: number;
  cabecera: string;
  /** Primeros valores no vacíos, para que el usuario reconozca la columna de un vistazo. */
  muestra: string[];
}

export interface Analisis {
  mapeo: Mapeo;
  /** Columnas del archivo con su muestra, para mapear a mano si hace falta. */
  columnas: ColumnaInfo[];
  /** true si hay fecha, concepto e importe: se puede importar sin preguntar nada. */
  completo: boolean;
  /** Campos obligatorios que no se han encontrado. */
  faltan: Campo[];
}

const texto = (v: any) => (v === null || v === undefined ? '' : String(v).trim());

/** ¿Tenemos lo mínimo para construir movimientos? Importe puede venir partido en cargos/abonos. */
export function camposQueFaltan(columnas: Mapeo['columnas']): Campo[] {
  const faltan: Campo[] = [];
  if (columnas.fecha === undefined) faltan.push('fecha');
  if (columnas.concepto === undefined) faltan.push('concepto');
  if (columnas.importe === undefined && columnas.debito === undefined && columnas.credito === undefined) {
    faltan.push('importe');
  }
  return faltan;
}

/** Clasifica una cabecera. Igualdad exacta primero; si no, que la contenga. */
function campoDeCabecera(cabecera: string, yaUsados: Set<Campo>): Campo | null {
  const n = normalizarTexto(cabecera);
  if (!n) return null;
  for (const exacto of [true, false]) {
    for (const campo of ORDEN) {
      if (yaUsados.has(campo)) continue;
      for (const syn of SINONIMOS[campo]) {
        if (exacto ? n === syn : n.includes(syn)) return campo;
      }
    }
  }
  return null;
}

/** Busca la fila de cabeceras: la de las primeras 25 que clasifica más columnas. */
function buscarCabecera(rows: any[][]): { fila: number; columnas: Mapeo['columnas'] } {
  let mejor = { fila: -1, columnas: {} as Mapeo['columnas'], puntos: 0 };
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const usados = new Set<Campo>();
    const columnas: Mapeo['columnas'] = {};
    for (let c = 0; c < row.length; c++) {
      const campo = campoDeCabecera(texto(row[c]), usados);
      if (campo) { columnas[campo] = c; usados.add(campo); }
    }
    // Una cabecera de verdad clasifica al menos fecha + algo de dinero.
    const puntos = usados.size;
    const sirve = columnas.fecha !== undefined &&
      (columnas.importe !== undefined || columnas.debito !== undefined || columnas.credito !== undefined);
    if (sirve && puntos > mejor.puntos) mejor = { fila: i, columnas, puntos };
  }
  return { fila: mejor.fila, columnas: mejor.columnas };
}

/**
 * Sin cabeceras reconocibles, deduce las columnas mirando los DATOS: cuál se lee como
 * fecha, cuáles como número y cuál lleva el texto largo.
 *
 * Para distinguir importe de saldo: el importe trae negativos (gastos), el saldo casi
 * nunca. Si empatan, el importe es el primero de los dos, que es el orden habitual.
 */
function deducirPorDatos(rows: any[][], desde: number): Mapeo['columnas'] {
  const nCols = rows.reduce((max, r) => Math.max(max, r?.length || 0), 0);
  const columnas: Mapeo['columnas'] = {};
  const perfiles: { c: number; fechas: number; numeros: number; negativos: number; largoTexto: number; muestras: number }[] = [];

  for (let c = 0; c < nCols; c++) {
    let fechas = 0, numeros = 0, negativos = 0, largo = 0, muestras = 0;
    for (let i = desde; i < rows.length && muestras < 40; i++) {
      const v = texto(rows[i]?.[c]);
      if (!v) continue;
      muestras++;
      // Leído en crudo, un saldo de 30.000 € también "es" una fecha de Excel. Las fechas
      // de verdad son números enteros; los importes casi nunca.
      const celda = rows[i][c];
      if (esFecha(celda) && (typeof celda !== 'number' || Number.isInteger(celda))) fechas++;
      const n = parseNumberString(v);
      if (!Number.isNaN(n) && /\d/.test(v)) { numeros++; if (n < 0) negativos++; }
      largo += v.length;
    }
    if (muestras > 0) perfiles.push({ c, fechas, numeros, negativos, largoTexto: largo / muestras, muestras });
  }

  const esMayoria = (parte: number, total: number) => total > 0 && parte / total >= 0.7;

  const colFecha = perfiles.filter(p => esMayoria(p.fechas, p.muestras)).sort((a, b) => a.c - b.c)[0];
  if (colFecha) columnas.fecha = colFecha.c;

  const numericas = perfiles
    .filter(p => p.c !== columnas.fecha && esMayoria(p.numeros, p.muestras))
    .sort((a, b) => b.negativos - a.negativos || a.c - b.c);
  if (numericas[0]) columnas.importe = numericas[0].c;
  if (numericas[1]) columnas.saldo = numericas[1].c;

  const usadas = new Set(Object.values(columnas));
  const textuales = perfiles
    .filter(p => !usadas.has(p.c) && !esMayoria(p.numeros, p.muestras))
    .sort((a, b) => b.largoTexto - a.largoTexto);
  if (textuales[0]) columnas.concepto = textuales[0].c;

  return columnas;
}

/**
 * Cómo se enseña una celda en la pantalla de mapeo. Leídas en crudo, las fechas de Excel
 * son números (46289); se muestran como fecha para que se reconozca la columna.
 */
function textoMuestra(v: any): string {
  if (typeof v === 'number' && Number.isInteger(v) && esFecha(v)) {
    const [y, m, d] = parseFecha(v).split('-');
    return `${d}/${m}/${y}`;
  }
  return texto(v);
}

/** Primeros valores no vacíos de cada columna, para la pantalla de mapeo manual. */
function describirColumnas(rows: any[][], mapeo: Mapeo): ColumnaInfo[] {
  const nCols = rows.reduce((max, r) => Math.max(max, r?.length || 0), 0);
  const cabecera = mapeo.filaCabecera >= 0 ? rows[mapeo.filaCabecera] : undefined;
  const info: ColumnaInfo[] = [];
  for (let c = 0; c < nCols; c++) {
    const muestra: string[] = [];
    for (let i = mapeo.filaDatos; i < rows.length && muestra.length < 3; i++) {
      const v = textoMuestra(rows[i]?.[c]);
      if (v) muestra.push(v.length > 34 ? `${v.slice(0, 34)}…` : v);
    }
    // Una columna entera vacía no le sirve a nadie para mapear.
    if (muestra.length === 0) continue;
    info.push({ indice: c, cabecera: texto(cabecera?.[c]) || `Columna ${c + 1}`, muestra });
  }
  return info;
}

/**
 * Analiza una hoja venga del banco que venga: primero intenta reconocer las cabeceras
 * por sinónimos y, si no hay manera, deduce las columnas por el contenido. Lo que no
 * consiga lo dice en `faltan`, para que la pantalla pida ayuda en vez de rendirse.
 */
export function analizarHoja(rows: any[][]): Analisis {
  const { fila, columnas } = buscarCabecera(rows);

  let mapeo: Mapeo;
  if (fila >= 0) {
    mapeo = { filaCabecera: fila, filaDatos: fila + 1, columnas };
  } else {
    // Sin cabecera fiable: los datos empiezan en la primera fila con algo dentro.
    const primera = rows.findIndex(r => r && r.some(c => texto(c) !== ''));
    const desde = primera < 0 ? 0 : primera;
    mapeo = { filaCabecera: -1, filaDatos: desde, columnas: deducirPorDatos(rows, desde) };
  }

  const faltan = camposQueFaltan(mapeo.columnas);
  return { mapeo, columnas: describirColumnas(rows, mapeo), completo: faltan.length === 0, faltan };
}

export interface ResultadoLectura {
  movimientos: Movimiento[];
  /** Nombres de categoría tal cual venían, por id. */
  categoriasEncontradas: Map<string, string>;
  /** Saldo de la primera fila que traiga uno, con su fecha. */
  saldoActual: number;
  fechaSaldo: string;
  /** Filas descartadas, con el motivo. */
  errores: string[];
}

const categoriaId = (nombre: string) => nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

/**
 * Construye los movimientos aplicando un mapeo (el detectado o el que haya elegido el
 * usuario). Las filas que no tengan fecha o importe se descartan con su motivo: en un
 * extracto siempre hay cabeceras repetidas, totales y líneas de relleno.
 */
export function leerConMapeo(rows: any[][], mapeo: Mapeo): ResultadoLectura {
  const { columnas } = mapeo;
  const movimientos: Movimiento[] = [];
  const categoriasEncontradas = new Map<string, string>();
  const errores: string[] = [];
  // Saldos leídos, con su fila: el que vale es el del día más reciente, no el de la
  // primera fila. Hay bancos que exportan del más antiguo al más nuevo.
  const saldos: { fecha: string; saldo: number; fila: number }[] = [];

  for (let i = mapeo.filaDatos; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => texto(c) === '')) continue;

    const fecha = columnas.fecha !== undefined ? parseFecha(row[columnas.fecha]) : '';
    if (!fecha) continue; // Sin fecha no es un movimiento: cabecera repetida, total, relleno…

    let importe = NaN;
    if (columnas.importe !== undefined) {
      importe = parseNumberString(texto(row[columnas.importe]));
    }
    if (Number.isNaN(importe) && (columnas.debito !== undefined || columnas.credito !== undefined)) {
      // Formato de dos columnas: los cargos van en negativo aunque se escriban en positivo.
      const cargo = columnas.debito !== undefined ? parseNumberString(texto(row[columnas.debito])) : NaN;
      const abono = columnas.credito !== undefined ? parseNumberString(texto(row[columnas.credito])) : NaN;
      if (!Number.isNaN(cargo) && cargo !== 0) importe = -Math.abs(cargo);
      else if (!Number.isNaN(abono) && abono !== 0) importe = Math.abs(abono);
    }
    if (Number.isNaN(importe)) {
      errores.push(`Fila ${i + 1}: importe ilegible`);
      continue;
    }

    const concepto = columnas.concepto !== undefined ? texto(row[columnas.concepto]) : '';
    const nombreCat = (columnas.categoria !== undefined ? texto(row[columnas.categoria]) : '') || 'Sin clasificar';
    const catId = categoriaId(nombreCat);
    categoriasEncontradas.set(catId, nombreCat);

    if (columnas.saldo !== undefined) {
      const s = parseNumberString(texto(row[columnas.saldo]));
      if (!Number.isNaN(s)) saldos.push({ fecha, saldo: s, fila: i });
    }
    const notas = columnas.notas !== undefined ? texto(row[columnas.notas]) : '';

    movimientos.push({
      id: uuidv4(),
      fecha,
      importe,
      concepto: concepto || 'Sin concepto',
      categoria: catId,
      subcategoria: columnas.subcategoria !== undefined ? texto(row[columnas.subcategoria]) || undefined : undefined,
      fuente: 'import:extracto',
      // Mismo hash que el resto de imports, para que el anti-duplicados siga sirviendo.
      hash: `${fecha}|${importe.toFixed(2)}|${concepto.toLowerCase()}`,
      ...(notas ? { notas } : {}),
    });
  }

  const { saldoActual, fechaSaldo } = saldoMasReciente(saldos);
  return { movimientos, categoriasEncontradas, saldoActual, fechaSaldo, errores };
}

/**
 * El saldo del último día del extracto. Si ese día hay varias filas, el saldo bueno es
 * el de la última operación: la primera fila en un extracto de nuevo a viejo (lo normal)
 * y la última en uno de viejo a nuevo.
 */
function saldoMasReciente(saldos: { fecha: string; saldo: number; fila: number }[]): { saldoActual: number; fechaSaldo: string } {
  if (saldos.length === 0) return { saldoActual: 0, fechaSaldo: '' };
  const ascendente = saldos[0].fecha < saldos[saldos.length - 1].fecha;
  let mejor = saldos[0];
  for (const s of saldos) {
    if (s.fecha > mejor.fecha || (s.fecha === mejor.fecha && ascendente)) mejor = s;
  }
  return { saldoActual: mejor.saldo, fechaSaldo: mejor.fecha };
}
