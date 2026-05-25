import { v4 as uuidv4 } from 'uuid';
import { Movimiento } from '../storage/types';

export interface ParsedResultado {
  banco: string;
  movimientos: Movimiento[];
  saldoActual: number;
  fechaSaldo: string; // YYYY-MM-DD local
  categoriasEncontradas: Set<string>;
}

function parseSpanishDate(dtStr: string): string {
  const parts = dtStr.trim().split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
}

function parseNumberString(val: any): number {
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

export async function parseExcelData(fileBase64OrBuffer: any): Promise<ParsedResultado> {
  const XLSX = await import('xlsx');
  
  const wb = XLSX.read(fileBase64OrBuffer, { type: 'binary' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  
  const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (!row) continue;
    const hasFValor = row.some(cell => typeof cell === 'string' && cell.includes('F. VALOR'));
    const hasDesc = row.some(cell => typeof cell === 'string' && cell.includes('DESCRIPCIÓN'));
    const hasImporte = row.some(cell => typeof cell === 'string' && cell.includes('IMPORTE'));
    
    if (hasFValor && hasDesc && hasImporte) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Formato no reconocido. Asegúrate de usar un extracto compatible que contenga las columnas F. VALOR, DESCRIPCIÓN e IMPORTE.');
  }

  const idxFecha = headers.findIndex(h => typeof h === 'string' && h.includes('F. VALOR'));
  const idxCat = headers.findIndex(h => typeof h === 'string' && h.includes('CATEGORÍA'));
  const idxSub = headers.findIndex(h => typeof h === 'string' && h.includes('SUBCATEGORÍA'));
  const idxDesc = headers.findIndex(h => typeof h === 'string' && h.includes('DESCRIPCIÓN'));
  const idxImp = headers.findIndex(h => typeof h === 'string' && h.includes('IMPORTE'));
  const idxSaldo = headers.findIndex(h => typeof h === 'string' && h.includes('SALDO'));

  const movimientos: Movimiento[] = [];
  const categoriasEncontradas = new Set<string>();
  
  let saldoReciente = 0;
  let fechaSaldo = '';
  let saldoEncontrado = false;

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;
    
    let fechaRaw = row[idxFecha];
    let catRaw = idxCat !== -1 ? row[idxCat] : 'Sin clasificar';
    let subRaw = idxSub !== -1 ? row[idxSub] : '';
    let descRaw = row[idxDesc];
    let impRaw = row[idxImp];
    let salRaw = idxSaldo !== -1 ? row[idxSaldo] : '';
    
    if (!fechaRaw || !descRaw || !impRaw) continue;

    const importe = parseNumberString(impRaw);
    if (isNaN(importe)) continue;
    
    const fecha = parseSpanishDate(String(fechaRaw));
    if (!fecha) continue;

    if (!saldoEncontrado && salRaw) {
      const parsedSaldo = parseNumberString(salRaw);
      if (!isNaN(parsedSaldo)) {
        saldoReciente = parsedSaldo;
        fechaSaldo = fecha;
        saldoEncontrado = true;
      }
    }

    const catName = String(catRaw).trim() || 'Sin clasificar';
    const concepto = String(descRaw).trim();
    
    const catId = catName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    categoriasEncontradas.add(catName);

    const hash = `${fecha}|${importe.toFixed(2)}|${concepto.toLowerCase()}`;

    movimientos.push({
      id: uuidv4(),
      fecha,
      importe,
      concepto,
      categoria: catId,
      subcategoria: String(subRaw).trim() || undefined,
      fuente: 'import:caixabank',
      hash
    });
  }

  return {
    banco: 'Importado',
    movimientos,
    saldoActual: saldoReciente,
    fechaSaldo,
    categoriasEncontradas
  };
}
