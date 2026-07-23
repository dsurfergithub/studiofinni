import { v4 as uuidv4 } from 'uuid';
import { Movimiento, Categoria } from '../storage/types';
import { getDeterministaColor } from '../colors';
import { parseNumberString } from './parser';

export interface ResultadoPlantilla {
  movimientos: Movimiento[];
  nuevasCategorias: Categoria[];
  errores: string[];
  duplicadosEnArchivo: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

function categoriaId(nombre: string): string {
  return nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
}

/** Acepta número de serie de Excel, Date, DD/MM/AAAA o AAAA-MM-DD. Devuelve '' si no es válida. */
function parseFecha(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  let y = 0, m = 0, d = 0;
  const EPOCH_EXCEL = Date.UTC(1899, 11, 30);
  // Redondeo al día más cercano: absorbe desfases de zona horaria en celdas de solo-fecha.
  const desdeDias = (dias: number) => {
    const dt = new Date(EPOCH_EXCEL + dias * 86400000);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  };
  if (val instanceof Date) {
    desdeDias(Math.round((val.getTime() - EPOCH_EXCEL) / 86400000));
  } else if (typeof val === 'number') {
    // Serial de Excel (epoch 1899-12-30). Solo aceptamos fechas >= 2000, fuera del bug de 1900.
    if (!isFinite(val) || val < 25569) return '';
    desdeDias(Math.round(val));
  } else {
    const s = String(val).trim();
    let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
    } else {
      match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (!match) return '';
      d = Number(match[1]); m = Number(match[2]); y = Number(match[3]);
      if (y < 100) y += 2000;
    }
  }
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  // Validar que el día existe en el mes (evita 31/02, etc.)
  const check = new Date(y, m - 1, d);
  if (check.getMonth() !== m - 1) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Genera y descarga la plantilla .xlsx con ejemplos e instrucciones. */
export async function descargarPlantillaGastos(categorias: Categoria[]): Promise<void> {
  const XLSX = await import('xlsx');

  const hoy = new Date();
  const fechaEjemplo = `${pad(hoy.getDate())}/${pad(hoy.getMonth() + 1)}/${hoy.getFullYear()}`;

  const gastos = [
    ['FECHA', 'CONCEPTO', 'IMPORTE', 'CATEGORÍA', 'TIPO', 'NOTAS'],
    [fechaEjemplo, 'Supermercado (ejemplo, bórrame)', '45,90', categorias[0]?.nombre || 'Sin clasificar', 'Gasto', ''],
    [fechaEjemplo, 'Nómina (ejemplo, bórrame)', '1500', 'Nómina', 'Ingreso', 'Las notas son opcionales'],
  ];
  const wsGastos = XLSX.utils.aoa_to_sheet(gastos);
  wsGastos['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 28 }];

  const instrucciones: string[][] = [
    ['PLANTILLA DE GASTOS — FINNI'],
    [''],
    ['Rellena la hoja "Gastos", una fila por movimiento, y súbela desde Ajustes → "Importar plantilla de gastos".'],
    ['La subida es incremental: solo AÑADE movimientos nuevos, nunca borra ni modifica los ya registrados.'],
    ['Los movimientos repetidos (misma fecha + importe + concepto) se detectan y se omiten automáticamente.'],
    [''],
    ['FECHA      Obligatoria. Formato DD/MM/AAAA (ej. 15/07/2026). También vale AAAA-MM-DD o una fecha de Excel.'],
    ['CONCEPTO   Obligatorio. Descripción del movimiento.'],
    ['IMPORTE    Obligatorio. Escribe la cantidad en positivo (ej. 45,90); el TIPO decide el signo.'],
    ['CATEGORÍA  Opcional. Si no existe en la app, se crea automáticamente. Vacía = "Sin clasificar".'],
    ['TIPO       Opcional. "Gasto" o "Ingreso". Vacío = Gasto.'],
    ['NOTAS      Opcional.'],
    [''],
    ['Tus categorías actuales:'],
    ...categorias.map(c => [`- ${c.nombre}`]),
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones);
  wsInstr['!cols'] = [{ wch: 110 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');
  XLSX.writeFile(wb, 'plantilla_gastos_finni.xlsx');
}

/**
 * Parsea una plantilla de gastos rellenada. Valida fila a fila y deduplica
 * contra `hashesExistentes` y dentro del propio archivo. No lanza por filas
 * inválidas: las acumula en `errores`.
 */
export async function parsePlantillaGastos(
  fileData: any,
  categoriasExistentes: Categoria[],
  hashesExistentes: Set<string>
): Promise<ResultadoPlantilla> {
  const XLSX = await import('xlsx');

  // raw:true en la LECTURA además del sheet_to_json: evita que SheetJS "adivine" las
  // fechas de texto ambiguas (DD/MM vs MM/DD) y las convierta a serie usando el formato
  // US (05/07 → 5-mayo en vez de 5-julio). Con raw:true recibimos el valor original
  // (string tal cual o serie de Excel de una celda-fecha real) y es NUESTRO parseFecha
  // —determinista DD/MM— quien decide. Sin esto, los gastos de un mes acaban en otro y
  // desaparecen de la lista de Movimientos del mes que miras.
  const wb = XLSX.read(fileData, { type: 'binary', raw: true });
  const sheetName = wb.SheetNames.find(n => normalizar(n) === 'GASTOS') || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: '' });

  let headerRowIndex = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = (rawData[i] || []).map(c => (typeof c === 'string' ? normalizar(c) : ''));
    if (row.includes('FECHA') && row.includes('CONCEPTO') && row.includes('IMPORTE')) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }
  if (headerRowIndex === -1) {
    throw new Error('No se encontraron las columnas FECHA, CONCEPTO e IMPORTE. Usa la plantilla descargable de Ajustes.');
  }

  const idxFecha = headers.indexOf('FECHA');
  const idxConcepto = headers.indexOf('CONCEPTO');
  const idxImporte = headers.indexOf('IMPORTE');
  const idxCategoria = headers.indexOf('CATEGORIA');
  const idxTipo = headers.indexOf('TIPO');
  const idxNotas = headers.indexOf('NOTAS');

  const movimientos: Movimiento[] = [];
  const nuevasCategorias: Categoria[] = [];
  const errores: string[] = [];
  let duplicadosEnArchivo = 0;

  // Mapa nombre normalizado → categoría (existentes + las que se vayan creando)
  const catPorNombre = new Map<string, Categoria>();
  categoriasExistentes.forEach(c => catPorNombre.set(normalizar(c.nombre), c));

  const hashesVistos = new Set<string>();

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
    const numFila = i + 1;

    const fecha = parseFecha(row[idxFecha]);
    if (!fecha) {
      errores.push(`Fila ${numFila}: fecha vacía o inválida (usa DD/MM/AAAA).`);
      continue;
    }

    const concepto = String(row[idxConcepto] ?? '').trim();
    if (!concepto) {
      errores.push(`Fila ${numFila}: falta el concepto.`);
      continue;
    }

    const importeRaw = row[idxImporte];
    const importeNum = importeRaw === '' || importeRaw === null ? NaN : parseNumberString(importeRaw);
    if (isNaN(importeNum) || importeNum === 0) {
      errores.push(`Fila ${numFila}: importe vacío, cero o no numérico.`);
      continue;
    }

    const tipoRaw = idxTipo !== -1 ? normalizar(String(row[idxTipo] ?? '')) : '';
    if (tipoRaw && tipoRaw !== 'GASTO' && tipoRaw !== 'INGRESO') {
      errores.push(`Fila ${numFila}: TIPO debe ser "Gasto" o "Ingreso" (o dejarse vacío).`);
      continue;
    }
    const esIngreso = tipoRaw === 'INGRESO';
    const importe = esIngreso ? Math.abs(importeNum) : -Math.abs(importeNum);

    const catNombre = (idxCategoria !== -1 ? String(row[idxCategoria] ?? '').trim() : '') || 'Sin clasificar';
    let cat = catPorNombre.get(normalizar(catNombre));
    if (!cat) {
      cat = {
        id: categoriaId(catNombre),
        nombre: catNombre,
        color: getDeterministaColor(catNombre),
        tipo: 'ambos',
      };
      catPorNombre.set(normalizar(catNombre), cat);
      nuevasCategorias.push(cat);
    }

    const notas = idxNotas !== -1 ? String(row[idxNotas] ?? '').trim() : '';

    // Las NOTAS forman parte de la huella anti-duplicados. En plantillas exportadas del
    // banco el CONCEPTO suele ser la categoría ("Otros ingresos") y el detalle que
    // distingue cada movimiento (p. ej. de quién es el Bizum) va en NOTAS. Sin incluirlas,
    // dos movimientos del mismo día, importe y categoría se colapsaban en uno y se perdían.
    // Re-subir el mismo archivo sigue deduplicando bien porque las notas son idénticas.
    const hash = `${fecha}|${importe.toFixed(2)}|${concepto.toLowerCase()}|${notas.toLowerCase()}`;
    if (hashesExistentes.has(hash) || hashesVistos.has(hash)) {
      duplicadosEnArchivo++;
      continue;
    }
    hashesVistos.add(hash);

    movimientos.push({
      id: uuidv4(),
      fecha,
      importe,
      concepto,
      categoria: cat.id,
      fuente: 'import:plantilla',
      hash,
      ...(notas ? { notas } : {}),
    });
  }

  // Solo devolver categorías nuevas que realmente se usen en movimientos aceptados
  const catsUsadas = new Set(movimientos.map(m => m.categoria));
  return {
    movimientos,
    nuevasCategorias: nuevasCategorias.filter(c => catsUsadas.has(c.id)),
    errores,
    duplicadosEnArchivo,
  };
}
