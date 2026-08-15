const pad = (n: number) => String(n).padStart(2, '0');

/** Quita acentos y deja en mayúsculas: para comparar cabeceras venga como venga. */
export function normalizarTexto(s: string): string {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

/**
 * Acepta número de serie de Excel, Date, DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA o AAAA-MM-DD.
 * Devuelve '' si no es una fecha válida.
 */
export function parseFecha(val: any): string {
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
    // AAAA-MM-DD y sus variantes con / o . (algunos bancos exportan 2026/08/14).
    let match = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
    if (match) {
      y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
    } else {
      // DD/MM/AAAA y sus variantes con - o . como separador.
      match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
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

/** ¿Esta celda se lee como fecha? */
export function esFecha(val: any): boolean {
  return parseFecha(val) !== '';
}

/** Lee un número escrito a la europea («1.234,56») o a la anglosajona («1,234.56»). */
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
