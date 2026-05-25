import { NominaAncla, MesFinanciero } from '../storage/types';

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
