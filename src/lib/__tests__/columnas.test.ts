import { describe, it, expect } from 'vitest';
import { analizarHoja, leerConMapeo, camposQueFaltan } from '../excel/columnas';

const leer = (filas: any[][]) => {
  const a = analizarHoja(filas);
  return { analisis: a, ...leerConMapeo(filas, a.mapeo) };
};

describe('detección de columnas por cabecera', () => {
  it('ING/CaixaBank: F. VALOR, DESCRIPCIÓN, IMPORTE (€), SALDO (€)', () => {
    const r = leer([
      ['Movimientos de la Cuenta', '', ''],
      [],
      ['F. VALOR', 'CATEGORÍA', 'SUBCATEGORÍA', 'DESCRIPCIÓN', 'IMPORTE (€)', 'SALDO (€)'],
      ['14/08/2026', 'Alimentación', 'Supermercados', 'Pago en DIA 8156', '-16.41', '614.00'],
      ['12/08/2026', 'Otros ingresos', 'Bizum', 'Bizum recibido', '500.00', '812.83'],
    ]);
    expect(r.analisis.completo).toBe(true);
    expect(r.movimientos).toHaveLength(2);
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-08-14', importe: -16.41, concepto: 'Pago en DIA 8156' });
    // CATEGORÍA no se confunde con SUBCATEGORÍA aunque una contenga a la otra.
    expect(r.categoriasEncontradas.get('alimentaci-n')).toBe('Alimentación');
    expect(r.movimientos[0].subcategoria).toBe('Supermercados');
    expect(r.saldoActual).toBe(614);
    expect(r.fechaSaldo).toBe('2026-08-14');
  });

  it('cabeceras en inglés', () => {
    const r = leer([
      ['Date', 'Description', 'Amount', 'Balance'],
      ['2026-08-14', 'Card payment', '-16.41', '614.00'],
    ]);
    expect(r.analisis.completo).toBe(true);
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-08-14', importe: -16.41, concepto: 'Card payment' });
  });

  it('importes en formato europeo con miles', () => {
    const r = leer([
      ['FECHA', 'CONCEPTO', 'IMPORTE'],
      ['31/07/2026', 'Nómina', '1.813,11'],
      ['01/08/2026', 'Alquiler', '-600,00'],
    ]);
    expect(r.movimientos.map(m => m.importe)).toEqual([1813.11, -600]);
  });

  it('columnas partidas en cargos y abonos: los cargos salen en negativo', () => {
    const r = leer([
      ['FECHA OPERACIÓN', 'CONCEPTO', 'CARGO', 'ABONO', 'SALDO'],
      ['05/08/2026', 'Compra super', '16,41', '', '600,00'],
      ['06/08/2026', 'Transferencia recibida', '', '250,00', '850,00'],
    ]);
    expect(r.analisis.completo).toBe(true);
    expect(r.movimientos.map(m => m.importe)).toEqual([-16.41, 250]);
  });

  it('se salta las filas de relleno, totales y cabeceras repetidas', () => {
    const r = leer([
      ['FECHA', 'CONCEPTO', 'IMPORTE'],
      ['05/08/2026', 'Compra', '-10,00'],
      ['', '', ''],
      ['', 'TOTAL', '-10,00'],
      ['FECHA', 'CONCEPTO', 'IMPORTE'],
      ['06/08/2026', 'Otra', '-5,00'],
    ]);
    expect(r.movimientos).toHaveLength(2);
    expect(r.errores).toEqual([]);
  });
});

describe('deducción por los datos, sin cabeceras', () => {
  it('adivina fecha, concepto e importe mirando el contenido', () => {
    const r = leer([
      ['14/08/2026', 'Pago en el supermercado del barrio', '-16,41', '614,00'],
      ['12/08/2026', 'Bizum recibido de un amigo', '500,00', '812,83'],
      ['11/08/2026', 'Gasolinera de la autopista', '-40,00', '312,83'],
    ]);
    expect(r.analisis.mapeo.filaCabecera).toBe(-1);
    expect(r.analisis.completo).toBe(true);
    expect(r.movimientos).toHaveLength(3);
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-08-14', importe: -16.41 });
    expect(r.movimientos[0].concepto).toContain('supermercado');
  });

  it('distingue importe de saldo: el importe es el que trae negativos', () => {
    const r = leer([
      ['14/08/2026', 'Compra', '-16,41', '614,00'],
      ['12/08/2026', 'Compra', '-20,00', '630,41'],
    ]);
    expect(r.movimientos.map(m => m.importe)).toEqual([-16.41, -20]);
  });
});

describe('cuando no llega para leerlo solo', () => {
  it('avisa de qué campos faltan en vez de dar el archivo por perdido', () => {
    const a = analizarHoja([
      ['Concepto raro', 'Otra cosa'],
      ['bla', 'ble'],
    ]);
    expect(a.completo).toBe(false);
    expect(a.faltan).toContain('fecha');
    expect(a.faltan).toContain('importe');
    // Y ofrece las columnas con una muestra, para poder mapearlas a mano.
    expect(a.columnas.length).toBe(2);
    expect(a.columnas[0].muestra.length).toBeGreaterThan(0);
  });

  it('un mapeo hecho a mano lee el archivo igual', () => {
    const filas = [
      ['col A', 'col B', 'col C'],
      ['14/08/2026', 'Compra', '-16,41'],
    ];
    const a = analizarHoja(filas);
    expect(a.completo).toBe(false);
    const r = leerConMapeo(filas, {
      filaCabecera: 0,
      filaDatos: 1,
      columnas: { fecha: 0, concepto: 1, importe: 2 },
    });
    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-08-14', importe: -16.41, concepto: 'Compra' });
  });

  it('camposQueFaltan acepta cargos/abonos en lugar de importe', () => {
    expect(camposQueFaltan({ fecha: 0, concepto: 1, debito: 2, credito: 3 })).toEqual([]);
    expect(camposQueFaltan({ fecha: 0, concepto: 1 })).toEqual(['importe']);
  });
});

describe('saldo y notas del extracto', () => {
  it('toma el saldo del día más reciente aunque el extracto vaya de viejo a nuevo', () => {
    const r = leer([
      ['FECHA', 'CONCEPTO', 'IMPORTE', 'SALDO'],
      ['01/08/2026', 'Uno', '-10', '90'],
      ['14/08/2026', 'Dos', '-5', '85'],
      ['14/08/2026', 'Tres', '-5', '80'],
    ]);
    expect(r.fechaSaldo).toBe('2026-08-14');
    expect(r.saldoActual).toBe(80);
  });

  it('de nuevo a viejo, el saldo es el de la primera fila del último día', () => {
    const r = leer([
      ['FECHA', 'CONCEPTO', 'IMPORTE', 'SALDO'],
      ['14/08/2026', 'Tres', '-5', '80'],
      ['14/08/2026', 'Dos', '-5', '85'],
      ['01/08/2026', 'Uno', '-10', '90'],
    ]);
    expect(r.saldoActual).toBe(80);
  });

  it('lee fechas de Excel en crudo y guarda el comentario como nota', () => {
    const r = leer([
      ['F. VALOR', 'DESCRIPCIÓN', 'COMENTARIO', 'IMPORTE (€)', 'SALDO (€)'],
      [46289, 'Pago en PASTISSERIA', 'Cumple', -8.5, 24.49],
    ]);
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-09-24', importe: -8.5, notas: 'Cumple' });
    expect(r.analisis.columnas[0].muestra[0]).toBe('24/09/2026');
  });
});
