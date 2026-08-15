import { v4 as uuidv4 } from 'uuid';
import { Movimiento, Categoria } from '../storage/types';
import { getDeterministaColor } from '../colors';
import { leerFilas } from './parser';
import { parseFecha, normalizarTexto, parseNumberString } from './valores';
import { analizarHoja, ErrorColumnas, Mapeo } from './columnas';

export interface ResultadoPlantilla {
  movimientos: Movimiento[];
  nuevasCategorias: Categoria[];
  errores: string[];
  duplicadosEnArchivo: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

// `parseFecha` y `normalizarTexto` viven en `valores.ts`: los comparte el lector genérico
// de extractos, que tiene que entender los mismos formatos de fecha que la plantilla.
const normalizar = normalizarTexto;

function categoriaId(nombre: string): string {
  return nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
}

/** ¿Esta fila es una cabecera repetida a media hoja? Si lo es, se salta sin quejarse. */
function esFilaDeCabecera(row: any[]): boolean {
  const celdas = row.map(c => normalizar(String(c ?? ''))).filter(Boolean);
  return celdas.length > 0 && celdas.every(c => CABECERAS_CONOCIDAS.has(c));
}

const CABECERAS_CONOCIDAS = new Set(['FECHA', 'CONCEPTO', 'IMPORTE', 'CATEGORIA', 'TIPO', 'NOTAS']);

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
  hashesExistentes: Set<string>,
  mapeoForzado?: Mapeo
): Promise<ResultadoPlantilla> {
  // raw:true evita que SheetJS "adivine" las fechas de texto ambiguas (DD/MM vs MM/DD)
  // y las convierta a serie usando el formato US (05/07 → 5-mayo en vez de 5-julio).
  // Con raw:true recibimos el valor original y es NUESTRO parseFecha —determinista
  // DD/MM— quien decide. Sin esto, los gastos de un mes acaban en otro y desaparecen
  // de la lista de Movimientos del mes que miras.
  const rawData = await leerFilas(fileData, { raw: true, hojaPreferida: 'Gastos' });

  // Misma detección que los extractos: la plantilla ya no exige que las columnas se
  // llamen exactamente FECHA/CONCEPTO/IMPORTE. Si no da, se lanza `ErrorColumnas` para
  // que la pantalla pida el mapeo a mano en vez de rechazar el archivo.
  const analisis = analizarHoja(rawData);
  const mapeo = mapeoForzado || analisis.mapeo;
  if (!mapeoForzado && !analisis.completo) throw new ErrorColumnas(analisis, rawData);

  const headerRowIndex = mapeo.filaDatos - 1;
  const idxFecha = mapeo.columnas.fecha;
  const idxConcepto = mapeo.columnas.concepto;
  const idxImporte = mapeo.columnas.importe;
  const idxCategoria = mapeo.columnas.categoria ?? -1;
  const idxTipo = mapeo.columnas.tipo ?? -1;
  const idxNotas = mapeo.columnas.notas ?? -1;
  if (idxFecha === undefined || idxConcepto === undefined || idxImporte === undefined) {
    throw new ErrorColumnas(analisis, rawData);
  }

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
      // La cabecera repetida a media hoja no es un error del usuario: es ruido del Excel.
      if (esFilaDeCabecera(row)) continue;
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
