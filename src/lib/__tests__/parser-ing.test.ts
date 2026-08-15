import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { parseExcelData } from '../excel/parser';

// Extracto real de ING que aportó el usuario (fuera del repo: contiene sus movimientos).
// Si no está, el test se salta en vez de fallar: sirve de comprobación local, no de CI.
const MUESTRA = 'C:/Users/Duser/Downloads/movements-1582026.xls';

describe.skipIf(!existsSync(MUESTRA))('extracto de ING', () => {
  it('lo lee el lector genérico sin descartar ninguna fila', async () => {
    // 'binary' = latin1: es exactamente lo que entrega FileReader.readAsBinaryString
    // en el navegador, que es como llega el archivo en la app.
    const r = await parseExcelData(readFileSync(MUESTRA, 'binary'));
    // 99 movimientos reales; el resto de filas del .xls son relleno vacío. Ninguna se descarta.
    expect(r.movimientos.length).toBe(99);

    const primero = r.movimientos[0];
    expect(primero.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof primero.importe).toBe('number');
    expect(Number.isNaN(primero.importe)).toBe(false);
    expect(primero.concepto.length).toBeGreaterThan(0);

    // La columna CATEGORÍA no se confunde con SUBCATEGORÍA (ambas contienen "CATEGORÍA").
    expect(r.categoriasEncontradas.has('Alimentación')).toBe(true);
    expect(r.categoriasEncontradas.has('Supermercados y alimentación')).toBe(false);

    // Importes con punto decimal («-16.41») y saldo de la fila más reciente.
    expect(r.movimientos.some(m => m.importe < 0)).toBe(true);
    expect(r.movimientos.some(m => m.importe > 0)).toBe(true);
    expect(r.fechaSaldo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
