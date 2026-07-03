import { Movimiento } from '../storage/types';

/** Normaliza un concepto para comparar: minúsculas, sin tildes ni espacios repetidos. */
export function normalizarConcepto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sugiere la categoría de un movimiento a partir del historial: busca movimientos con
 * un concepto igual o que se contenga mutuamente (p. ej. "mercadona" ~ "compra mercadona")
 * y devuelve la categoría más usada entre ellos. Devuelve null si no hay señal clara.
 */
export function sugerirCategoria(concepto: string, historial: Movimiento[]): string | null {
  const n = normalizarConcepto(concepto);
  if (n.length < 3) return null;

  const votos: Record<string, number> = {};
  for (const m of historial) {
    if (!m.categoria || m.categoria === 'sin-clasificar') continue;
    const c = normalizarConcepto(m.concepto);
    if (c.length < 3) continue;
    if (c === n) {
      votos[m.categoria] = (votos[m.categoria] || 0) + 3; // coincidencia exacta pesa más
    } else if (c.includes(n) || n.includes(c)) {
      votos[m.categoria] = (votos[m.categoria] || 0) + 1;
    }
  }

  let mejor: string | null = null;
  let max = 0;
  for (const [catId, v] of Object.entries(votos)) {
    if (v > max) {
      max = v;
      mejor = catId;
    }
  }
  return mejor;
}
