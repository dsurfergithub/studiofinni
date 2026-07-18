import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePlantillaGastos } from '../excel/plantilla';
import { Categoria } from '../storage/types';

const cats: Categoria[] = [];

function xlsxDesde(aoa: any[][]): any {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
  return XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
}

const HEADER = ['FECHA', 'CONCEPTO', 'IMPORTE', 'CATEGORIA', 'TIPO', 'NOTAS'];

describe('parsePlantillaGastos — fechas DD/MM deterministas', () => {
  it('CSV con fechas DD/MM no se voltean a MM/DD (formato US)', async () => {
    const csv =
      'FECHA,CONCEPTO,IMPORTE,CATEGORIA,TIPO,NOTAS\n' +
      '05/07/2026,Super,54.30,Comida,Gasto,\n' +
      '12/07/2026,Gasolina,60,Transporte,Gasto,\n' +
      '25/07/2026,Nomina,1500,Nomina,Ingreso,';
    const res = await parsePlantillaGastos(csv, cats, new Set());
    const porConcepto = Object.fromEntries(res.movimientos.map(m => [m.concepto, m.fecha]));
    expect(porConcepto['Super']).toBe('2026-07-05');
    expect(porConcepto['Gasolina']).toBe('2026-07-12');
    expect(porConcepto['Nomina']).toBe('2026-07-25');
  });

  it('xlsx con fechas de texto DD/MM', async () => {
    const file = xlsxDesde([
      HEADER,
      ['05/07/2026', 'SuperTexto', '54,30', 'Comida', 'Gasto', ''],
      ['12/07/2026', 'GasTexto', '60', 'Transporte', 'Gasto', ''],
    ]);
    const res = await parsePlantillaGastos(file, cats, new Set());
    const f = res.movimientos.map(m => m.fecha).sort();
    expect(f).toEqual(['2026-07-05', '2026-07-12']);
  });

  it('xlsx con fechas de celda-fecha real (serial) conserva el día', async () => {
    const file = xlsxDesde([
      HEADER,
      [new Date(2026, 6, 5), 'SuperFecha', 54.3, 'Comida', 'Gasto', ''],
      [new Date(2026, 11, 12), 'BizumDic', 30, 'Ocio', 'Gasto', ''],
    ]);
    const res = await parsePlantillaGastos(file, cats, new Set());
    const f = res.movimientos.map(m => m.fecha).sort();
    expect(f).toEqual(['2026-07-05', '2026-12-12']);
  });
});
