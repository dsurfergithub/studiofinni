import { Categoria, MacroTipo, Movimiento } from '../storage/types';
import { normalizarConcepto } from '../categorias/sugerencias';
import { getDeterministaColor } from '../colors';
import { esAjusteDeSaldo } from '../saldo/cuadre';

export const SIN_CLASIFICAR = 'sin-clasificar';

/** De dónde sale la categoría que se propone para un movimiento. */
export type Origen = 'historial' | 'banco' | 'palabra' | 'ninguno';

export const ETIQUETA_ORIGEN: Record<Origen, string> = {
  historial: 'como otras veces',
  banco: 'según el banco',
  palabra: 'por el nombre',
  ninguno: 'sin pista',
};

/** Una categoría elegible en la revisión: ya existente en la app o por crear al importar. */
export interface OpcionCategoria {
  id: string;
  nombre: string;
  color: string;
  icono?: string;
  macro?: MacroTipo;
  nueva: boolean;
}

/** Movimientos del mismo comercio o concepto, para categorizarlos de una vez. */
export interface GrupoImport {
  clave: string;
  etiqueta: string;
  /** Un concepto tal cual lo escribe el banco, para reconocer el grupo. */
  ejemplo: string;
  ids: string[];
  /** Suma con signo: negativo si es sobre todo gasto. */
  total: number;
}

export interface Propuesta {
  movimientos: Movimiento[];
  grupos: GrupoImport[];
  /** Categoría propuesta para cada movimiento, por id. */
  asignacion: Record<string, string>;
  origen: Record<string, Origen>;
  opciones: OpcionCategoria[];
}

// ---------------------------------------------------------------------------
// Clave de comercio
// ---------------------------------------------------------------------------

/**
 * Prefijos con los que los bancos adornan el concepto. El orden importa: los largos
 * antes que los cortos que contienen («pago bizum en» antes que «pago en»).
 * `persona: true` = lo que sigue es un nombre de persona, y se agrupa por nombre completo.
 */
const PREFIJOS: { re: RegExp; etiqueta?: string; persona?: boolean }[] = [
  { re: /^devolucion (tarjeta|pago bizum en|compra( en)?)\s*/ },
  { re: /^devolucion\s+/ },
  { re: /^pago bizum en\s+/ },
  { re: /^bizum enviado a\s+/, etiqueta: 'Bizum a', persona: true },
  { re: /^bizum recibido de\s+/, etiqueta: 'Bizum de', persona: true },
  { re: /^bizum\s+/, etiqueta: 'Bizum', persona: true },
  { re: /^transferencia emitida periodica\b.*/, etiqueta: 'Transferencia periódica' },
  { re: /^transferencia (emitida|enviada) a\s+/, etiqueta: 'Transferencia a', persona: true },
  { re: /^transferencia (recibida|a su favor) de\s+/, etiqueta: 'Transferencia de', persona: true },
  { re: /^transferencia (a|de)\s+/, etiqueta: 'Transferencia', persona: true },
  { re: /^traspaso interno (emitido|enviado)\b.*/, etiqueta: 'Traspaso a tus cuentas' },
  { re: /^traspaso interno recibido\b.*/, etiqueta: 'Traspaso de tus cuentas' },
  { re: /^traspaso\b.*/, etiqueta: 'Traspaso' },
  { re: /^nomina recibida\b.*/, etiqueta: 'Nómina' },
  { re: /^(retirada|reintegro)( ing| efectivo| cajero)?\b.*/, etiqueta: 'Cajero' },
  { re: /^(pago movil en|pago con tarjeta en|pago en|compra (con )?tarjeta( en)?|compra ing|compra en|compra|recibo|adeudo( recibo)?|cargo( por)?|abono por campana)\s+/ },
];

/** Primeras palabras que no identifican al comercio solas: se añade la siguiente. */
const GENERICAS = new Set([
  'bar', 'cafe', 'cafeteria', 'restaurante', 'restaurant', 'rest', 'pizzeria', 'farmacia', 'super',
  'supermercado', 'supermercados', 'tienda', 'estacion', 'parking', 'park', 'grupo', 'house', 'don',
  'cal', 'can', 'casa', 'santa', 'sant', 'san', 'fruteria', 'frutas', 'carniceria', 'alimentacion',
  'panaderia', 'forn', 'pastisseria', 'pasteleria', 'market', 'mercado', 'hotel', 'clinica', 'optica',
  'the', 'sp', 'bd', 'co', 'es', 'abe', 'club', 'centro', 'autoservicio', 'gasolinera', 'area',
  'tarjeta', 'app', 'global', 'trade', 'record', 'grand', 'gran', 'nuevo', 'nueva', 'bon', 'tu', 'mi',
]);

const VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'sl', 'sa', 'slu', 'www', 'com', 'es']);

/** Nombres con los que un mismo comercio aparece en distintos extractos. */
const ALIAS: Record<string, string> = { amzn: 'amazon', vinzbarbershop: 'vinz' };

const capitalizar = (s: string) => s.replace(/\b\p{L}/gu, c => c.toUpperCase());

/**
 * Reduce un concepto al comercio o persona que hay detrás, para agrupar lo que el banco
 * escribe de mil maneras: «Pago en MERCADONA TORDERA», «Pago en MERCADONA AVDA. …» y
 * «Devolución Tarjeta MERCADONA …» son todos «mercadona».
 */
export function claveComercio(concepto: string): { clave: string; etiqueta: string } {
  let s = normalizarConcepto(concepto);
  let prefijo: (typeof PREFIJOS)[number] | undefined;
  for (const p of PREFIJOS) {
    if (p.re.test(s)) {
      prefijo = p;
      s = s.replace(p.re, '');
      break;
    }
  }

  const palabras = s
    .split(/[^a-z0-9ñ]+/)
    .filter(t => t.length >= 2 && !/\d/.test(t) && !VACIAS.has(t))
    .map(t => ALIAS[t] || t);

  let nucleo: string[];
  if (prefijo?.persona) nucleo = palabras.slice(0, 2);
  else if (palabras.length > 1 && GENERICAS.has(palabras[0])) nucleo = palabras.slice(0, 2);
  else nucleo = palabras.slice(0, 1);

  const cuerpo = nucleo.join(' ');
  if (prefijo?.etiqueta) {
    const clave = [normalizarConcepto(prefijo.etiqueta), cuerpo].filter(Boolean).join(' · ');
    return { clave, etiqueta: [prefijo.etiqueta, capitalizar(cuerpo)].filter(Boolean).join(' ') };
  }
  if (!cuerpo) {
    // Nada reconocible (solo números o símbolos): el concepto entero, tal cual.
    const entero = normalizarConcepto(concepto) || 'sin concepto';
    return { clave: entero, etiqueta: concepto.trim() || 'Sin concepto' };
  }
  return { clave: cuerpo, etiqueta: capitalizar(cuerpo) };
}

// ---------------------------------------------------------------------------
// Palabras clave → categoría (para extractos sin categorías y sin historial)
// ---------------------------------------------------------------------------

interface ReglaPalabra {
  id: string;
  nombre: string;
  color: string;
  icono: string;
  macro?: MacroTipo;
  palabras: string[];
}

/** Mismos ids que las categorías que propone el onboarding, para reutilizarlas si existen. */
const REGLAS: ReglaPalabra[] = [
  {
    id: 'nomina', nombre: 'Nómina', color: '#34d399', icono: 'briefcase',
    palabras: ['nomina', 'salario', 'sueldo', 'payroll'],
  },
  {
    id: 'alimentacion', nombre: 'Alimentación', color: '#4ade80', icono: 'shopping-cart', macro: 'variable',
    palabras: ['mercadona', 'lidl', 'aldi', 'carrefour', 'dia', 'eroski', 'consum', 'bonpreu', 'caprabo', 'alcampo',
      'hipercor', 'supeco', 'ahorramas', 'condis', 'spar', 'froiz', 'gadis', 'supermercado', 'supermercados',
      'fruteria', 'frutas', 'carniceria', 'panaderia', 'forn', 'market', 'alimentacion', 'mercat', 'lupa', 'masymas'],
  },
  {
    id: 'restaurantes', nombre: 'Restaurantes', color: '#fbbf24', icono: 'coffee', macro: 'variable',
    palabras: ['restaurante', 'restaurant', 'bar', 'cafe', 'cafeteria', 'pizzeria', 'burger', 'mcdonalds', 'kfc',
      'telepizza', 'dominos', 'glovo', 'just eat', 'uber eats', 'deliveroo', 'sushi', 'kebab', 'starbucks',
      'tapas', 'brasa', 'pastisseria', 'pasteleria', 'granja', 'cerveceria', 'taberna'],
  },
  {
    id: 'transporte', nombre: 'Transporte', color: '#fb923c', icono: 'car', macro: 'variable',
    palabras: ['repsol', 'cepsa', 'galp', 'shell', 'petronor', 'petroprix', 'ballenoil', 'plenoil', 'gasolinera',
      'aucat', 'autopista', 'autopistas', 'peaje', 'parking', 'aparcamiento', 'renfe', 'metro', 'tmb', 'fgc', 'taxi',
      'uber', 'cabify', 'bolt', 'norauto', 'midas', 'feu vert', 'itv', 'blablacar', 'ouigo', 'iryo', 'vueling',
      'ryanair', 'iberia', 'aena', 'mobilitat', 'diesel', 'yego'],
  },
  {
    id: 'hogar', nombre: 'Hogar', color: '#60a5fa', icono: 'home', macro: 'fijo',
    palabras: ['iberdrola', 'endesa', 'naturgy', 'holaluz', 'aigues', 'canal isabel', 'movistar', 'vodafone',
      'orange', 'digi', 'jazztel', 'masmovil', 'pepephone', 'simyo', 'lowi', 'yoigo', 'alquiler', 'comunidad',
      'ikea', 'leroy merlin', 'bricomart', 'bauhaus'],
  },
  {
    id: 'salud', nombre: 'Salud', color: '#ff5478', icono: 'heart', macro: 'fijo',
    palabras: ['farmacia', 'clinica', 'dentista', 'dental', 'hospital', 'optica', 'sanitas', 'adeslas', 'dkv',
      'fisioterapia', 'fisio', 'medico', 'asisa'],
  },
  {
    id: 'ocio', nombre: 'Ocio', color: '#e879f9', icono: 'music', macro: 'variable',
    palabras: ['netflix', 'spotify', 'hbo', 'disney', 'prime video', 'cine', 'cinesa', 'yelmo', 'steam',
      'playstation', 'xbox', 'nintendo', 'gimnasio', 'gym', 'dazn', 'ticketmaster', 'entradas', 'booking',
      'airbnb', 'hotel', 'tulotero', 'loteria', 'once'],
  },
  {
    id: 'compras', nombre: 'Compras', color: '#a78bfa', icono: 'tag', macro: 'variable',
    palabras: ['amazon', 'zara', 'primark', 'decathlon', 'mediamarkt', 'media markt', 'corte ingles', 'aliexpress',
      'shein', 'bershka', 'pull bear', 'massimo dutti', 'fnac', 'action', 'tiger', 'alehop', 'druni', 'sephora',
      'barber', 'peluqueria'],
  },
];

const escaparRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REGLAS_RE = REGLAS.map(r => ({ regla: r, re: new RegExp(`\\b(${r.palabras.map(escaparRe).join('|')})\\b`) }));

/**
 * Categoría que sugiere el propio texto del concepto, si alguna palabra lo delata. Gana
 * la palabra que sale antes: en «AUCAT BAR VALLCARCA» el comercio es el peaje, no el bar.
 */
export function reglaPorPalabra(concepto: string): ReglaPalabra | null {
  const n = normalizarConcepto(concepto);
  let mejor: { regla: ReglaPalabra; pos: number } | null = null;
  for (const { regla, re } of REGLAS_RE) {
    const m = re.exec(n);
    if (m && (!mejor || m.index < mejor.pos)) mejor = { regla, pos: m.index };
  }
  return mejor?.regla || null;
}

// ---------------------------------------------------------------------------
// Propuesta
// ---------------------------------------------------------------------------

const slug = (nombre: string) => nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

/**
 * Prepara la revisión de una importación: agrupa los movimientos por comercio y propone
 * una categoría para cada uno. Por orden de confianza:
 *
 * 1. **Historial**: lo que ya hiciste con ese comercio en la app. Si recategorizaste
 *    «Mercadona» de «Alimentación» a «Súper», manda lo tuyo.
 * 2. **Banco**: la categoría que trae el extracto, reutilizando la tuya si se llama igual.
 * 3. **Palabra clave**: «farmacia», «repsol», «netflix»… para extractos sin categorías.
 * 4. Si no hay pista, «Sin clasificar», y el grupo se marca para revisar.
 */
export function proponerCategorias({
  movimientos,
  nombresBanco,
  categorias,
  historial,
}: {
  movimientos: Movimiento[];
  /** Nombre de categoría del banco por el id que lleva cada movimiento importado. */
  nombresBanco: Map<string, string>;
  categorias: Categoria[];
  historial: Movimiento[];
}): Propuesta {
  const opciones = new Map<string, OpcionCategoria>();
  for (const c of categorias) opciones.set(c.id, { id: c.id, nombre: c.nombre, color: c.color, icono: c.icono, macro: c.macro, nueva: false });
  const porNombre = new Map(categorias.map(c => [normalizarConcepto(c.nombre), c.id]));

  /** Id de una categoría por su nombre: la existente si se llama igual, o una nueva. */
  const resolver = (nombre: string, extra: Partial<OpcionCategoria> = {}, idPreferido?: string): string => {
    const existente = porNombre.get(normalizarConcepto(nombre)) || (idPreferido && opciones.has(idPreferido) ? idPreferido : undefined);
    if (existente) return existente;
    const id = idPreferido || slug(nombre);
    if (!opciones.has(id)) {
      opciones.set(id, { id, nombre, color: getDeterministaColor(nombre), nueva: true, ...extra });
      porNombre.set(normalizarConcepto(nombre), id);
    }
    return id;
  };

  // Qué categoría ha acabado teniendo cada comercio en la app.
  const votos = new Map<string, Map<string, number>>();
  for (const m of historial) {
    if (!m.categoria || m.categoria === SIN_CLASIFICAR || esAjusteDeSaldo(m) || !opciones.has(m.categoria)) continue;
    const { clave } = claveComercio(m.concepto);
    const v = votos.get(clave) || new Map<string, number>();
    v.set(m.categoria, (v.get(m.categoria) || 0) + 1);
    votos.set(clave, v);
  }
  const deHistorial = (clave: string): string | null => {
    const v = votos.get(clave);
    if (!v) return null;
    return Array.from(v.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };

  const asignacion: Record<string, string> = {};
  const origen: Record<string, Origen> = {};
  const grupos = new Map<string, GrupoImport>();

  for (const m of movimientos) {
    const { clave, etiqueta } = claveComercio(m.concepto);
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = { clave, etiqueta, ejemplo: m.concepto, ids: [], total: 0 };
      grupos.set(clave, grupo);
    }
    grupo.ids.push(m.id);
    grupo.total += m.importe;

    const historica = deHistorial(clave);
    const nombreBanco = m.categoria && m.categoria !== SIN_CLASIFICAR ? nombresBanco.get(m.categoria) : undefined;
    const regla = reglaPorPalabra(m.concepto);
    if (historica) {
      asignacion[m.id] = historica;
      origen[m.id] = 'historial';
    } else if (nombreBanco) {
      asignacion[m.id] = resolver(nombreBanco, {}, m.categoria);
      origen[m.id] = 'banco';
    } else if (regla) {
      asignacion[m.id] = resolver(regla.nombre, { color: regla.color, icono: regla.icono, macro: regla.macro }, regla.id);
      origen[m.id] = 'palabra';
    } else {
      asignacion[m.id] = SIN_CLASIFICAR;
      origen[m.id] = 'ninguno';
    }
  }
  if (!opciones.has(SIN_CLASIFICAR)) {
    opciones.set(SIN_CLASIFICAR, { id: SIN_CLASIFICAR, nombre: 'Sin clasificar', color: '#7a7a92', nueva: true });
  }

  return {
    movimientos,
    // Los grupos grandes primero: son los que más movimientos resuelven de un toque.
    grupos: Array.from(grupos.values()).sort((a, b) => b.ids.length - a.ids.length || Math.abs(b.total) - Math.abs(a.total)),
    asignacion,
    origen,
    // Primero las tuyas, luego las nuevas, cada bloque por nombre.
    opciones: Array.from(opciones.values()).sort((a, b) => Number(a.nueva) - Number(b.nueva) || a.nombre.localeCompare(b.nombre, 'es')),
  };
}

/**
 * Aplica lo decidido en la revisión: cada movimiento con su categoría final y solo las
 * categorías nuevas que de verdad se usan (las que el usuario ha descartado no se crean).
 */
export function construirImportacion(
  movimientos: Movimiento[],
  asignacion: Record<string, string>,
  opciones: OpcionCategoria[]
): { movimientos: Movimiento[]; nuevasCategorias: Categoria[] } {
  const finales = movimientos.map(m => ({ ...m, categoria: asignacion[m.id] || m.categoria }));
  const usadas = new Set(finales.map(m => m.categoria));
  const nuevasCategorias: Categoria[] = opciones
    .filter(o => o.nueva && usadas.has(o.id))
    .map(o => ({
      id: o.id, nombre: o.nombre, color: o.color, tipo: 'ambos' as const,
      ...(o.icono ? { icono: o.icono } : {}),
      ...(o.macro ? { macro: o.macro } : {}),
    }));
  return { movimientos: finales, nuevasCategorias };
}
