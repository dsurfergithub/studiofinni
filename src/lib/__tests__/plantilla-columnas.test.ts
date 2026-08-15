import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePlantillaGastos } from '../excel/plantilla';
import { ErrorColumnas } from '../excel/columnas';
import { Categoria } from '../storage/types';

const cats: Categoria[] = [];

function xlsxDesde(aoa: any[][], hoja = 'Gastos'): any {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), hoja);
  return XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
}

describe('la plantilla ya no exige los nombres exactos de columna', () => {
  it('acepta sinónimos: DESCRIPCIÓN en vez de CONCEPTO', async () => {
    const file = xlsxDesde([
      ['FECHA', 'DESCRIPCIÓN', 'IMPORTE', 'CATEGORÍA', 'TIPO'],
      ['05/07/2026', 'Super', '54,30', 'Comida', 'Gasto'],
    ]);
    const r = await parsePlantillaGastos(file, cats, new Set());
    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-07-05', importe: -54.3, concepto: 'Super' });
  });

  it('acepta cabeceras en inglés', async () => {
    const file = xlsxDesde([
      ['Date', 'Description', 'Amount', 'Category'],
      ['05/07/2026', 'Groceries', '-54,30', 'Comida'],
    ]);
    const r = await parsePlantillaGastos(file, cats, new Set());
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-07-05', importe: -54.3 });
  });

  it('acepta columnas en otro orden', async () => {
    const file = xlsxDesde([
      ['CATEGORIA', 'IMPORTE', 'FECHA', 'CONCEPTO'],
      ['Comida', '54,30', '05/07/2026', 'Super'],
    ]);
    const r = await parsePlantillaGastos(file, cats, new Set());
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-07-05', concepto: 'Super', importe: -54.3 });
  });

  it('sigue prefiriendo la hoja "Gastos" aunque haya otras con más filas', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['FECHA', 'CONCEPTO', 'IMPORTE'],
      ['05/07/2026', 'De Gastos', '10'],
    ]), 'Gastos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['FECHA', 'CONCEPTO', 'IMPORTE'],
      ...Array.from({ length: 20 }, (_, i) => ['0%d/07/2026'.replace('%d', String(i + 1)), 'Instrucción', '1']),
    ]), 'Instrucciones');
    const r = await parsePlantillaGastos(XLSX.write(wb, { type: 'binary', bookType: 'xlsx' }), cats, new Set());
    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0].concepto).toBe('De Gastos');
  });

  it('el TIPO sigue mandando sobre el signo del importe', async () => {
    const file = xlsxDesde([
      ['FECHA', 'CONCEPTO', 'IMPORTE', 'TIPO'],
      ['05/07/2026', 'Nómina', '1500', 'Ingreso'],
      ['06/07/2026', 'Super', '54,30', 'Gasto'],
      ['07/07/2026', 'Sin tipo', '20', ''],
    ]);
    const r = await parsePlantillaGastos(file, cats, new Set());
    expect(r.movimientos.map(m => m.importe)).toEqual([1500, -54.3, -20]);
  });

  it('las NOTAS siguen entrando en la huella anti-duplicados', async () => {
    const file = xlsxDesde([
      ['FECHA', 'DESCRIPCIÓN', 'IMPORTE', 'COMENTARIO'],
      ['13/07/2026', 'Otros ingresos', '32', 'Bizum de Demba'],
      ['13/07/2026', 'Otros ingresos', '32', 'Bizum de Eloy'],
    ]);
    const r = await parsePlantillaGastos(file, cats, new Set());
    expect(r.movimientos).toHaveLength(2);
    expect(r.duplicadosEnArchivo).toBe(0);
  });

  it('una cabecera repetida a media hoja se salta sin contarla como error', async () => {
    const file = xlsxDesde([
      ['FECHA', 'CONCEPTO', 'IMPORTE'],
      ['05/07/2026', 'Super', '10'],
      ['FECHA', 'CONCEPTO', 'IMPORTE'],
      ['06/07/2026', 'Otra', '20'],
    ]);
    const r = await parsePlantillaGastos(file, cats, new Set());
    expect(r.movimientos).toHaveLength(2);
    expect(r.errores).toEqual([]);
  });
});

describe('cuando no se reconocen las columnas', () => {
  const raro = () => xlsxDesde([
    ['Dia', 'Ref', 'Text', 'Quantitat'],
    ['05/07/2026', '900112', 'Compra', '54,30'],
  ]);

  /** Corre el parseo esperando que falle por columnas, y devuelve ese error tipado. */
  async function capturarError(): Promise<ErrorColumnas> {
    try {
      await parsePlantillaGastos(raro(), cats, new Set());
    } catch (e) {
      if (e instanceof ErrorColumnas) return e;
      throw e;
    }
    throw new Error('se esperaba un ErrorColumnas y no se lanzó ninguno');
  }

  it('lanza ErrorColumnas con el análisis, en vez de rechazar el archivo', async () => {
    const err = await capturarError();
    expect(err.analisis.columnas.length).toBe(4);
    expect(err.analisis.faltan.length).toBeGreaterThan(0);
  });

  it('con un mapeo a mano lee el archivo igual', async () => {
    const err = await capturarError();
    const r = await parsePlantillaGastos(raro(), cats, new Set(), {
      ...err.analisis.mapeo,
      filaCabecera: 0,
      filaDatos: 1,
      columnas: { fecha: 0, concepto: 2, importe: 3 },
    });
    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-07-05', concepto: 'Compra', importe: -54.3 });
  });
});
