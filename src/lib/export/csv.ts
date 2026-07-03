import { Categoria, Movimiento } from '../storage/types';

function campo(v: string): string {
  // Escapado CSV estándar: comillas dobladas y campo entrecomillado si hace falta.
  if (/[";\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/**
 * Convierte los movimientos a CSV compatible con Excel en español:
 * separador ';' y decimales con coma.
 */
export function movimientosACsv(movimientos: Movimiento[], categorias: Categoria[]): string {
  const catById = new Map(categorias.map(c => [c.id, c.nombre]));
  const filas = [
    ['Fecha', 'Concepto', 'Categoría', 'Importe', 'En presupuesto', 'Origen', 'Notas'].join(';'),
    ...movimientos.map(m => [
      m.fecha,
      campo(m.concepto),
      campo(catById.get(m.categoria) || 'Sin clasificar'),
      String(m.importe.toFixed(2)).replace('.', ','),
      m.enPresupuesto === false ? 'No' : 'Sí',
      m.fuente === 'suscripcion' ? 'Recurrente' : m.fuente.startsWith('import') ? 'Importado' : 'Manual',
      campo(m.notas || ''),
    ].join(';')),
  ];
  // BOM para que Excel detecte UTF-8 y muestre bien las tildes.
  return '\ufeff' + filas.join('\n');
}
