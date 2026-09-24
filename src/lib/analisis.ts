import { Categoria, Movimiento } from './storage/types';
import { esAjusteDeSaldo } from './saldo/cuadre';

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * ¿El nombre de esta categoría es de dinero que solo cambia de cuenta? ING, por ejemplo,
 * mete los traspasos internos en «Movimientos excluidos». Se usa para proponer marcarla
 * como fuera del análisis, nunca para decidirlo a escondidas del usuario.
 */
export function esCategoriaDeTraspaso(nombre: string): boolean {
  return /\b(movimientos excluidos|excluidos|traspasos?|entre cuentas|transferencias internas)\b/.test(normalizar(nombre));
}

/** Ids de las categorías que no cuentan en ingresos, gastos ni comparativas. */
export function categoriasFueraDeAnalisis(categorias: Categoria[]): Set<string> {
  return new Set(categorias.filter(c => c.excluirDeAnalisis).map(c => c.id));
}

/**
 * ¿Cuenta este movimiento como ingreso o gasto? Los ajustes de cuadre y las categorías
 * fuera del análisis (traspasos) mueven el saldo, pero no son dinero que ganas ni gastas.
 */
export function cuentaEnAnalisis(m: Movimiento, fuera: Set<string>): boolean {
  return !esAjusteDeSaldo(m) && !fuera.has(m.categoria);
}
