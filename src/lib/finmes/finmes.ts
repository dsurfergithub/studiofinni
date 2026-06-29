import { NominaAncla, MesFinanciero, Movimiento } from '../storage/types';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function stringToNum(d: string): [number, number, number] {
  const [y, m, da] = d.split('-').map(Number);
  return [y, m - 1, da];
}

function dateToString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const newD = new Date(d);
  newD.setDate(newD.getDate() + days);
  return newD;
}

function esFechaValida(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Devuelve una fecha (YYYY-MM-DD) que cae dentro del rango del mes financiero dado,
 * intentando conservar el día del mes de `fecha`. Se usa al reasignar manualmente un
 * movimiento a otro mes financiero: como la pertenencia a un mes se deriva de la fecha,
 * mover un movimiento a otro mes implica ajustar su fecha al rango de ese mes.
 */
export function fechaDentroDeMes(mes: MesFinanciero, fecha: string): string {
  if (fecha >= mes.inicio && fecha <= mes.fin) return fecha;
  const dd = fecha.slice(8, 10);
  // El periodo puede solapar dos meses naturales (nómina a mitad de mes), así que
  // probamos el día en el mes natural del inicio y en el del fin antes de caer al inicio.
  // Validamos que el candidato sea una fecha real (p. ej. evitar 31 de un mes de 30 días).
  const candidatos = [`${mes.inicio.slice(0, 7)}-${dd}`, `${mes.fin.slice(0, 7)}-${dd}`];
  for (const c of candidatos) {
    if (c >= mes.inicio && c <= mes.fin && esFechaValida(c)) return c;
  }
  return mes.inicio;
}

/**
 * Devuelve el id del mes financiero al que pertenece un movimiento.
 * - Si tiene un pin (`mesId`) que apunta a un mes existente, ese es su mes (traspaso explícito).
 * - Si no, se deriva de la fecha (primer mes cuyo rango la contiene).
 * Garantiza una atribución única: un movimiento nunca cuenta en dos meses a la vez.
 */
export function mesIdDeMovimiento(mov: Movimiento, meses: MesFinanciero[]): string | undefined {
  if (mov.mesId && meses.some(m => m.id === mov.mesId)) return mov.mesId;
  return meses.find(m => mov.fecha >= m.inicio && mov.fecha <= m.fin)?.id;
}

/** ¿Pertenece el movimiento al mes dado? Respeta el pin explícito y evita duplicados. */
export function movimientoEnMes(mov: Movimiento, mes: MesFinanciero, meses: MesFinanciero[]): boolean {
  if (mov.mesId && meses.some(m => m.id === mov.mesId)) return mov.mesId === mes.id;
  return mov.fecha >= mes.inicio && mov.fecha <= mes.fin;
}

export function calcularNombreMes(inicio: string, fin: string): { nombre: string, clave: string } {
  const startD = new Date(...stringToNum(inicio) as [number, number, number]);
  const endD = new Date(...stringToNum(fin) as [number, number, number]);
  
  // Logic: see which calendar month has more days in this range
  let curr = new Date(startD);
  const counts: Record<string, number> = {};
  
  while (curr <= endD) {
    const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
    counts[key] = (counts[key] || 0) + 1;
    curr.setDate(curr.getDate() + 1);
  }
  
  let bestKey = '';
  let maxCount = -1;
  for (const [k, c] of Object.entries(counts)) {
    if (c > maxCount) {
      maxCount = c;
      bestKey = k;
    }
  }
  
  const [yStr, mStr] = bestKey.split('-');
  const monthName = MONTH_NAMES[parseInt(mStr, 10) - 1];
  return { nombre: `${monthName} ${yStr}`, clave: bestKey };
}

/**
 * Genera `cantidad` periodos mensuales consecutivos a partir del final de `baseMes`.
 * Se usa para planificar meses futuros (resto del año).
 */
export function generarMesesFuturos(baseMes: MesFinanciero, cantidad: number): MesFinanciero[] {
  const generados: MesFinanciero[] = [];
  let currentFin = baseMes.fin;

  for (let i = 0; i < cantidad; i++) {
    const [y, mIndex, d] = currentFin.split('-').map(Number);
    const startDate = new Date(y, mIndex - 1, d + 1);
    const startStr = dateToString(startDate);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate() - 1);
    const endStr = dateToString(endDate);
    const { nombre, clave } = calcularNombreMes(startStr, endStr);
    generados.push({ id: `mes-${clave}`, nombre, clave, inicio: startStr, fin: endStr, esEstimado: true });
    currentFin = endStr;
  }
  return generados;
}

/** Nº de meses naturales que quedan hasta diciembre desde el mes de `baseMes`. */
export function mesesRestantesDelAnio(baseMes: MesFinanciero): number {
  const [, mStr] = baseMes.clave.split('-');
  return Math.max(0, 12 - parseInt(mStr, 10));
}

export function derivarMeses(nominas: NominaAncla[]): MesFinanciero[] {
  if (!nominas || nominas.length === 0) {
    // Return current month if no data
    const d = new Date();
    const [y, m] = [d.getFullYear(), d.getMonth()];
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // last day
    const nm = calcularNombreMes(dateToString(start), dateToString(end));
    return [{
      id: nm.clave,
      nombre: nm.nombre,
      clave: nm.clave,
      inicio: dateToString(start),
      fin: dateToString(end)
    }];
  }

  // Sort ascending by date
  const sorted = [...nominas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const meses: MesFinanciero[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const isLast = i === sorted.length - 1;
    const current = sorted[i];
    
    // start is current fecha
    const inicio = current.fecha;
    
    // fin es next fecha - 1 day, OR if last, current + approx 30 days
    let finD: Date;
    let estimado = false;
    if (!isLast) {
      const next = sorted[i + 1];
      finD = addDays(new Date(...stringToNum(next.fecha) as [number, number, number]), -1);
    } else {
      finD = addDays(new Date(...stringToNum(current.fecha) as [number, number, number]), 29); // + 1 month roughly
      estimado = true;
    }
    
    const fin = dateToString(finD);
    const nm = calcularNombreMes(inicio, fin);
    
    meses.push({
      id: `mes-${current.id || nm.clave}`,
      nombre: nm.nombre,
      clave: nm.clave,
      inicio,
      fin,
      esEstimado: estimado
    });
  }
  
  return meses.reverse(); // Newest first
}
